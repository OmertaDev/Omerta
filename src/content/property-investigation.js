// A complete property inquiry, interpreted by the existing mystery runtime. Evidence is cosmetic
// graph state; only the separately pinned deed eligibility policy can authorize a primary claim.
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}

const discover = (nodeId) => ({ adapter: 'discover', nodeId });
const evidence = (nodeId) => ({ adapter: 'evidence_grant', nodeId });
const step = (id, district, interactionId, title, description, options = {}) => ({
  id, type: 'mystery_step', version: 1, visibility: 'discovered',
  conditions: [{ adapter: 'location', value: district },
    { adapter: 'explicit_interaction', interactionId }],
  metadata: { title, description }, ...options,
});
const proof = (id, source, title, description) => ({
  id, type: 'evidence', version: 1, visibility: 'discovered', requires: [source],
  metadata: { title, description },
});

export const PROPERTY_INVESTIGATION_PACKAGE = frozen({
  id: 'property-investigation', version: 1, season: 'core', dependsOn: [],
  nodes: [
    step('mystery:property-briefing', 'docks', 'property_briefing', 'A House With a Past',
      'Irene Bell, the registry clerk: An empty house is not an ownerless house. Learn how an address, an occupant and a boundary fit together before you claim one. Start with the Docks ledger, follow the occupancy trail through Neon Mile, and take the survey to the Foundry. Bring the evidence back to me.', {
        visibility: 'public',
        conditions: [{ adapter: 'location', value: 'docks' }, { adapter: 'level', value: 15 },
          { adapter: 'explicit_interaction', interactionId: 'property_briefing' }],
        effects: [discover('mystery:property-ledger')],
      }),
    step('mystery:property-ledger', 'docks', 'property_inspect_ledger', 'Read the Old Registry',
      'Inspect the numbered entry and its correction slip. The house was renumbered after a fire, but the last occupancy entry still uses the earlier address. Copy both references before you leave.', {
        requires: ['mystery:property-briefing'], effects: [evidence('evidence:property-ledger')],
      }),
    proof('evidence:property-ledger', 'mystery:property-ledger', 'The Corrected Registry Entry',
      'A dated correction links the former house number to the current address.'),
    {
      id: 'choice:property-approach', type: 'choice', version: 1, visibility: 'public',
      requires: ['mystery:property-ledger', 'evidence:property-ledger'],
      conditions: [{ adapter: 'location', value: 'docks' },
        { adapter: 'explicit_interaction', interactionId: 'property_choose_approach' }],
      options: [
        { id: 'witness', title: 'Trace the last occupant through a witness',
          excludes: ['mystery:property-records'], effects: [discover('mystery:property-witness')] },
        { id: 'records', title: 'Trace the last occupant through delivery records',
          excludes: ['mystery:property-witness'], effects: [discover('mystery:property-records')] },
      ],
      metadata: { title: 'Choose an Occupancy Trail',
        description: 'Irene: Mara in Neon Mile remembers the last tenant. The delivery office keeps a second record. Commit to one trail, verify its account, then compare it with the address plate. Your chosen approach is permanent for this inquiry.' },
    },
    step('mystery:property-witness', 'neon', 'property_interview_witness', 'Interview the Neighbor',
      'Mara Voss: I remember the tenant moving out after the fire, before the new number went up. Compare her account with the dated correction. Record the old number she identifies, rather than assuming an empty window proves abandonment.', {
        requires: ['choice:property-approach', 'evidence:property-ledger'],
        excludes: ['mystery:property-records'],
        effects: [evidence('evidence:property-witness'), discover('mystery:property-address')],
      }),
    step('mystery:property-records', 'neon', 'property_inspect_records', 'Inspect the Delivery Book',
      'At the Neon Mile delivery office, compare the final signed delivery with the registry correction. Separate the old house number from the forwarding address and record when deliveries stopped.', {
        requires: ['choice:property-approach', 'evidence:property-ledger'],
        excludes: ['mystery:property-witness'],
        effects: [evidence('evidence:property-records'), discover('mystery:property-address')],
      }),
    proof('evidence:property-witness', 'mystery:property-witness', 'The Neighbor’s Account',
      'A witness identifies the former number and dates the last occupant’s departure.'),
    proof('evidence:property-records', 'mystery:property-records', 'The Final Signed Delivery',
      'The delivery book separates the former house number from the forwarding address.'),
    step('mystery:property-address', 'neon', 'property_verify_address', 'Verify the Address Plate',
      'Inspect the surviving plate and the municipal renumbering notice. Match them against your chosen occupancy evidence. The two addresses describe one property, not two available claims. Take the verified reference to the Foundry survey desk.', {
        requires: ['choice:property-approach', 'evidence:property-ledger'],
        requiresAny: [['mystery:property-witness', 'mystery:property-records'],
          ['evidence:property-witness', 'evidence:property-records']],
        effects: [evidence('evidence:property-address'), discover('mystery:property-survey')],
      }),
    proof('evidence:property-address', 'mystery:property-address', 'The Verified Address Reference',
      'The registry correction, occupancy trail and physical plate agree on a single address.'),
    step('mystery:property-survey', 'foundry', 'property_inspect_survey', 'Inspect the Survey Plan',
      'Surveyor Enzo Ferri unfolds the original plan. Compare its parcel reference with the address record. Copy the alley easement and the shared wall marker; a painted doorway alone does not define the property boundary.', {
        requires: ['mystery:property-address', 'evidence:property-address'],
        effects: [evidence('evidence:property-survey'), discover('mystery:property-boundary')],
      }),
    proof('evidence:property-survey', 'mystery:property-survey', 'The Survey and Easement',
      'The recorded parcel includes a shared wall and preserves public access through the alley.'),
    step('mystery:property-boundary', 'foundry', 'property_compare_boundary', 'Resolve the Boundary Discrepancy',
      'Enzo: The maintenance note calls the alley part of the yard. Compare its sketch with the signed survey and identify the public easement. Record why the private boundary stops at the wall, then return to Irene at the Docks.', {
        requires: ['mystery:property-survey', 'evidence:property-survey', 'evidence:property-address'],
        effects: [evidence('evidence:property-boundary'), discover('mystery:property-reconcile')],
      }),
    proof('evidence:property-boundary', 'mystery:property-boundary', 'The Resolved Boundary',
      'The maintenance sketch is corrected against the signed plan; the alley remains a public easement.'),
    step('mystery:property-reconcile', 'docks', 'property_reconcile_registry', 'Reconcile the Property File',
      'Back at the Docks, lay out the corrected ledger, occupancy account, address reference, survey and boundary finding. Irene checks their dates and records why the old and new numbers refer to the same parcel. An incomplete file cannot reach title verification.', {
        requires: ['mystery:property-boundary', 'evidence:property-ledger', 'evidence:property-address',
          'evidence:property-survey', 'evidence:property-boundary'],
        requiresAny: [['evidence:property-witness', 'evidence:property-records']],
        effects: [evidence('evidence:property-title-file'), discover('mystery:property-verify-title')],
      }),
    proof('evidence:property-title-file', 'mystery:property-reconcile', 'The Reconciled Title File',
      'A complete file connects one address, its occupancy history and its lawful boundary.'),
    step('mystery:property-verify-title', 'docks', 'property_verify_title', 'Verify the Title File',
      'Irene: Read back the verified address, identify the occupancy source, and acknowledge the alley easement. Confirm this complete record explicitly. You may then choose an unclaimed building in your current district and submit your one primary property claim. Verification does not reserve a building or issue a deed by itself.', {
        requires: ['mystery:property-reconcile', 'evidence:property-ledger', 'evidence:property-address',
          'evidence:property-survey', 'evidence:property-boundary', 'evidence:property-title-file'],
        requiresAny: [['evidence:property-witness', 'evidence:property-records']],
        effects: [{ adapter: 'status_award', nodeId: 'reward:property-dossier-verified' }],
        metadata: { title: 'Verify the Title File', terminal: true,
          description: 'Irene: Read back the verified address, identify the occupancy source, and acknowledge the alley easement. Explicitly confirm the complete file. This qualifies your account to claim one unclaimed building in your current district; it neither reserves a property nor issues a deed.' },
      }),
    {
      id: 'reward:property-dossier-verified', type: 'reward', version: 1, visibility: 'hidden',
      requires: ['mystery:property-verify-title'],
      metadata: { title: 'A Verified Property Dossier', inert: true, rewardType: 'status',
        description: 'A cosmetic record of your completed registry inquiry. Property eligibility is checked separately when you claim.' },
    },
  ],
});

export const PROPERTY_QUEST_VENUES = frozen({
  'mystery:property-briefing': 'fixer', 'mystery:property-ledger': 'stories',
  'choice:property-approach': 'fixer', 'mystery:property-witness': 'fixer',
  'mystery:property-records': 'stories', 'mystery:property-address': 'fixer',
  'mystery:property-survey': 'workshop', 'mystery:property-boundary': 'workshop',
  'mystery:property-reconcile': 'stories', 'mystery:property-verify-title': 'fixer',
});

export const PROPERTY_QUEST_DISTRICTS = frozen(Object.fromEntries(
  PROPERTY_INVESTIGATION_PACKAGE.nodes.flatMap((node) => {
    const location = node.conditions?.find((condition) => condition.adapter === 'location');
    return location ? [[node.id, location.value]] : [];
  }),
));

export const PROPERTY_QUEST_PRESENTATION = frozen({
  graphId: PROPERTY_INVESTIGATION_PACKAGE.id, version: 1, title: 'A House With a Past',
  description: 'Follow an occupancy trail through the Docks, Neon Mile and the Foundry. Reconcile the evidence and verify a property title file.',
  ownerScope: 'character', cityQuest: true, districtId: 'docks', startVenueId: 'fixer', exploreVenueId: 'fixer',
  rewardTitle: 'Verified Property Dossier', deathPolicy: 'immutable_history_no_inheritance',
});

export default PROPERTY_INVESTIGATION_PACKAGE;
