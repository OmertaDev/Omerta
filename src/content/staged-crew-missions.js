// One Crew mission interpreted by the existing role, contribution and custody runtime.
// Explicit participation advances its stages; the single keepsake is inert and account-owned.
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}

const graphId = 'staged-crew-missions', operationId = 'operation:quiet-pier-run';
const plan = 'operation:quiet-pier-plan', watch = 'operation:quiet-pier-watch';
const execute = 'operation:quiet-pier-execute', getaway = 'operation:quiet-pier-getaway';
const conditions = interactionId => [
  { adapter: 'location', value: 'docks' },
  { adapter: 'explicit_interaction', interactionId },
];

export const STAGED_CREW_MISSIONS_PACKAGE = frozen({
  id: graphId, version: 1, season: 'core', dependsOn: ['district-docks-story'], nodes: [
    {
      id: operationId, type: 'social_gate', version: 1, visibility: 'public',
      requires: ['mystery:district-docks-story-report'], conditions: [{ adapter: 'location', value: 'docks' }],
      effects: [
        { adapter: 'unique_item_award', templateId: 'item:quiet_pier_manifest', recipientRoleId: 'driver' },
        { adapter: 'status_award', nodeId: 'reward:quiet-pier-crew' },
      ],
      metadata: {
        title: 'The Quiet Pier Run',
        description: 'Plan a route, confirm the lookout signal, execute the switch and finish the getaway. Three different Crew members take responsibility for the run.',
        lore: 'The planner must have closed the Docks ferry case. Each participant takes their own role; a route cannot execute before the lookout has confirmed it.',
        minimumDistinctAccounts: 3,
        roles: [
          { id: 'planner', title: 'Planner', distinct: true, description: 'Mark the route, execute the switch and close the completed run.',
            conditions: [{ adapter: 'location', value: 'docks' }] },
          { id: 'lookout', title: 'Lookout', distinct: true, description: 'Read the marked route and confirm the safe signal.',
            conditions: [{ adapter: 'location', value: 'docks' }] },
          { id: 'driver', title: 'Driver', distinct: true, description: 'Wait for execution, then complete the getaway.',
            conditions: [{ adapter: 'location', value: 'docks' }] },
        ],
        closerRoleId: 'planner',
        mysteryGate: { graphId: 'district-docks-story', graphVersion: 1, ownerScope: 'character', requiredStatus: 'completed' },
        completionRequires: [plan, watch, execute, getaway],
      },
    },
    {
      id: plan, type: 'operation_step', version: 1, visibility: 'role_private', requires: [operationId],
      conditions: conditions('quiet_pier_mark_route'),
      effects: [{ adapter: 'evidence_grant', nodeId: 'evidence:quiet-pier-route' }],
      metadata: { title: 'Mark the Pier Route', description: 'Compare the corrected ferry account with the pier map and commit one route for the Crew.',
        operationId, roleId: 'planner', order: 1 },
    },
    {
      id: 'evidence:quiet-pier-route', type: 'evidence', version: 1, visibility: 'role_private', requires: [plan],
      metadata: { title: 'Marked Pier Route', privateEvidence: 'Use the service gate beside the empty ferry berth; the public loading lane belongs to the morning crew.',
        operationId, roleId: 'planner' },
    },
    {
      id: watch, type: 'operation_step', version: 1, visibility: 'role_private', requires: [operationId, plan],
      conditions: conditions('quiet_pier_confirm_signal'),
      effects: [{ adapter: 'evidence_grant', nodeId: 'evidence:quiet-pier-signal' }],
      metadata: { title: 'Confirm the Lookout Signal', description: 'Watch the marked service gate and commit the agreed signal before the planner executes.',
        operationId, roleId: 'lookout', order: 2 },
    },
    {
      id: 'evidence:quiet-pier-signal', type: 'evidence', version: 1, visibility: 'role_private', requires: [watch],
      metadata: { title: 'Lookout Signal', privateEvidence: 'Two low lantern flashes mean the service gate is clear; one flash means hold the run.',
        operationId, roleId: 'lookout' },
    },
    {
      id: execute, type: 'operation_step', version: 1, visibility: 'public', requires: [operationId, plan, watch],
      conditions: conditions('quiet_pier_execute_switch'),
      metadata: { title: 'Execute the Pier Switch', description: 'With the route and lookout confirmed, commit the planned switch and tell the driver the run is ready to leave.',
        operationId, roleId: 'planner', order: 3 },
    },
    {
      id: getaway, type: 'operation_step', version: 1, visibility: 'public', requires: [operationId, execute],
      conditions: conditions('quiet_pier_complete_getaway'),
      metadata: { title: 'Complete the Getaway', description: 'Wait for the executed switch, take the agreed exit and sign the completed run for the Crew.',
        operationId, roleId: 'driver', order: 4 },
    },
    {
      id: 'item:quiet_pier_manifest', type: 'item_template', version: 1, visibility: 'hidden',
      metadata: { title: 'Quiet Pier Manifest', description: 'A signed manifest from a completed Crew run. An inert keepsake held by its driver account; it grants no economic or combat benefit.',
        inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false },
    },
    {
      id: 'reward:quiet-pier-crew', type: 'reward', version: 1, visibility: 'hidden', requires: [operationId],
      metadata: { title: 'Quiet Pier Crew', description: 'The Crew completed every stage of its pier run.', operationId, inert: true, rewardType: 'status' },
    },
  ],
});

export const STAGED_CREW_MISSION_PRESENTATION = frozen({
  graphId, version: 1, operationNodeId: operationId, districtId: 'docks', venueId: 'clubhouse',
  title: 'The Quiet Pier Run', description: STAGED_CREW_MISSIONS_PACKAGE.nodes[0].metadata.description,
  stages: [
    { nodeId: plan, title: 'Planning', roleId: 'planner' },
    { nodeId: watch, title: 'Lookout', roleId: 'lookout' },
    { nodeId: execute, title: 'Execution', roleId: 'planner' },
    { nodeId: getaway, title: 'Getaway', roleId: 'driver' },
  ],
});
