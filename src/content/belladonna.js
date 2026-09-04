// Belladonna Lockbox is the Phase 1 vertical proof for the world-graph item economy.
//
// The package contains only immutable data. The shared crafting runtime supplies the exact
// automotive salvage chain; the mystery and operation runtimes interpret the nodes below through
// their allow-listed adapters. In particular, this file has no callback, SQL, cash, or OMR
// authority.
const frozen = (value) => Object.freeze(value);

const condition = (adapter, fields) => frozen({ adapter, ...fields });
const effect = (adapter, fields) => frozen({ adapter, ...fields });

const operationId = 'operation:belladonna-lockbox';

const roles = frozen([
  frozen({ id: 'investigator', title: 'Investigator', distinct: true }),
  frozen({ id: 'driver', title: 'Driver', distinct: true }),
  frozen({
    id: 'mechanic',
    title: 'Mechanic',
    distinct: true,
    conditions: frozen([condition('skill', { skillId: 'fence_network' })]),
  }),
  frozen({ id: 'enforcer', title: 'Enforcer', distinct: true }),
]);

export const BELLADONNA_PACKAGE = frozen({
  id: 'belladonna-demo',
  version: 1,
  season: 'core',
  dependsOn: frozen(['core-materials', 'automotive-salvage']),
  nodes: frozen([
    // The individual investigation is pinned to its exact character owner by the runtime. Its
    // crafted tool enters mystery custody, then returns to that same character on terminal close.
    frozen({
      id: 'mystery:belladonna-trace',
      type: 'mystery_step',
      version: 1,
      visibility: 'public',
      conditions: frozen([
        condition('location', { value: 'foundry' }),
        condition('explicit_interaction', { interactionId: 'inspect_belladonna_stamp' }),
      ]),
      effects: frozen([
        effect('discover', { nodeId: 'mystery:belladonna-lock' }),
      ]),
      metadata: frozen({ title: 'Trace the Belladonna Stamp' }),
    }),
    frozen({
      id: 'mystery:belladonna-lock',
      type: 'mystery_step',
      version: 1,
      visibility: 'discovered',
      requires: frozen(['mystery:belladonna-trace']),
      conditions: frozen([
        condition('item_ownership', { templateId: 'item:precision_lock_tool' }),
        condition('explicit_interaction', { interactionId: 'set_precision_tumblers' }),
      ]),
      effects: frozen([
        effect('item_escrow', { templateId: 'item:precision_lock_tool' }),
        effect('evidence_grant', { nodeId: 'evidence:belladonna-maker-mark' }),
        effect('discover', { nodeId: 'mystery:belladonna-file-closed' }),
      ]),
      metadata: frozen({ title: 'Set the Precision Tumblers' }),
    }),
    frozen({
      id: 'evidence:belladonna-maker-mark',
      type: 'evidence',
      version: 1,
      visibility: 'discovered',
      requires: frozen(['mystery:belladonna-lock']),
      metadata: frozen({ title: 'Belladonna Maker Mark' }),
    }),
    frozen({
      id: 'mystery:belladonna-file-closed',
      type: 'mystery_step',
      version: 1,
      visibility: 'discovered',
      requires: frozen([
        'mystery:belladonna-lock',
        'evidence:belladonna-maker-mark',
      ]),
      conditions: frozen([
        condition('explicit_interaction', { interactionId: 'seal_belladonna_file' }),
      ]),
      metadata: frozen({
        title: 'Seal the Belladonna File',
        terminal: true,
      }),
    }),

    // The completed character-pinned mystery is the only bridge into the Crew operation. All four
    // roles are account-distinct, every branch is ordered, and the root names the full convergence
    // set and the sole closer.
    frozen({
      id: operationId,
      type: 'social_gate',
      version: 1,
      visibility: 'public',
      requires: frozen(['mystery:belladonna-file-closed']),
      minimumDistinctAccounts: 4,
      roles,
      effects: frozen([
        effect('unique_item_award', {
          templateId: 'item:belladonna_artifact',
          recipientRoleId: 'investigator',
        }),
        effect('status_award', { nodeId: 'reward:belladonna-crew-status' }),
      ]),
      metadata: frozen({
        title: 'The Belladonna Lockbox',
        phase1Proof: true,
        closerRoleId: 'investigator',
        mysteryGate: frozen({
          graphId: 'belladonna-demo',
          graphVersion: 1,
          ownerScope: 'character',
          requiredStatus: 'completed',
        }),
        completionRequires: frozen([
          'operation:belladonna-investigate',
          'operation:belladonna-drive',
          'operation:belladonna-mechanic',
          'operation:belladonna-enforce',
        ]),
      }),
    }),
    frozen({
      id: 'operation:belladonna-investigate',
      type: 'operation_step',
      version: 1,
      visibility: 'role_private',
      requires: frozen([operationId]),
      conditions: frozen([
        condition('explicit_interaction', { interactionId: 'read_belladonna_cipher' }),
      ]),
      effects: frozen([
        effect('evidence_grant', { nodeId: 'evidence:belladonna-cipher-fragment' }),
      ]),
      metadata: frozen({
        title: 'Read the Belladonna Cipher',
        operationId,
        roleId: 'investigator',
        order: 1,
      }),
    }),
    frozen({
      id: 'evidence:belladonna-cipher-fragment',
      type: 'evidence',
      version: 1,
      visibility: 'role_private',
      requires: frozen(['operation:belladonna-investigate']),
      metadata: frozen({
        title: 'Cipher Fragment',
        privateEvidence: 'The fourth petal marks the false hinge.',
        operationId,
        roleId: 'investigator',
      }),
    }),
    frozen({
      id: 'operation:belladonna-drive',
      type: 'operation_step',
      version: 1,
      visibility: 'public',
      requires: frozen([operationId, 'operation:belladonna-investigate']),
      conditions: frozen([
        condition('explicit_interaction', { interactionId: 'stage_belladonna_car' }),
      ]),
      metadata: frozen({
        title: 'Stage the Getaway Car',
        operationId,
        roleId: 'driver',
        order: 2,
      }),
    }),
    frozen({
      id: 'operation:belladonna-mechanic',
      type: 'operation_step',
      version: 1,
      visibility: 'role_private',
      requires: frozen([operationId, 'operation:belladonna-drive']),
      conditions: frozen([
        condition('item_ownership', { templateId: 'item:precision_lock_tool' }),
      ]),
      effects: frozen([
        effect('item_escrow', { templateId: 'item:precision_lock_tool' }),
        effect('evidence_grant', { nodeId: 'evidence:belladonna-tumbler-pattern' }),
      ]),
      metadata: frozen({
        title: 'Float the Lockbox Tumblers',
        operationId,
        roleId: 'mechanic',
        order: 3,
      }),
    }),
    frozen({
      id: 'evidence:belladonna-tumbler-pattern',
      type: 'evidence',
      version: 1,
      visibility: 'role_private',
      requires: frozen(['operation:belladonna-mechanic']),
      metadata: frozen({
        title: 'Tumbler Pattern',
        privateEvidence: 'The maker reversed the last two gates.',
        operationId,
        roleId: 'mechanic',
      }),
    }),
    frozen({
      id: 'operation:belladonna-enforce',
      type: 'operation_step',
      version: 1,
      visibility: 'public',
      requires: frozen([operationId, 'operation:belladonna-mechanic']),
      conditions: frozen([
        condition('explicit_interaction', { interactionId: 'secure_belladonna_room' }),
      ]),
      metadata: frozen({
        title: 'Secure the Lockbox Room',
        operationId,
        roleId: 'enforcer',
        order: 4,
      }),
    }),
    frozen({
      id: 'reward:belladonna-crew-status',
      type: 'reward',
      version: 1,
      visibility: 'hidden',
      repeatability: 'once',
      metadata: frozen({
        title: 'Belladonna Confidants',
        operationId,
        rewardType: 'status',
        inert: true,
        finite: true,
      }),
    }),
  ]),
});

export default BELLADONNA_PACKAGE;
