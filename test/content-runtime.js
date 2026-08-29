import assert from 'node:assert/strict';
import { compileContentPack } from '../src/content/compiler.js';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { PACING, REGIMEN, masteryXpFor } from '../src/rules.js';
import {
  activateContentBundle,
  contentBoard,
  createContentInstance,
  contentInstanceBoard,
  joinContentInstance,
  setContentConsent,
  actOnContentInstance,
  leaveContentInstance,
  claimContentRewards,
} from '../src/content/runtime.js';

const packSource = (version, title = 'The Sixth Chair') => {
  const nodes = [
    { id: 'the-sixth-chair', type: 'mystery', payload: { title } },
    { id: 'crew-policy', type: 'party_policy', payload: {
      organizationScopes: ['crew', 'extended_family'], uniqueParticipants: true,
      roleLockOnStart: true, recheckConsent: true,
    } },
    { id: 'four-seat-quorum', type: 'quorum', payload: {
      minimumParticipants: 4, uniqueParticipants: true, minimumOrganizations: 1,
    } },
    { id: 'archivist', type: 'role', payload: {
      title: 'Archivist', participantKinds: ['agent', 'human_eligible_non_agent'],
    } },
    { id: 'driver', type: 'role', payload: {
      title: 'Driver', participantKinds: ['agent', 'human_eligible_non_agent'],
    } },
    { id: 'broker', type: 'role', payload: {
      title: 'Broker', participantKinds: ['agent', 'human_eligible_non_agent'],
    } },
    { id: 'witness', type: 'role', payload: {
      title: 'Witness', participantKinds: ['human_eligible_non_agent'], consentRequired: true,
    } },
    { id: 'ledger-chapter', type: 'chapter', payload: { title: 'The Ledger With Six Columns' } },
    { id: 'archive-puzzle', type: 'puzzle', payload: {
      title: 'The Burned Margin', prompt: 'Name the missing family.',
      gates: [{ kind: 'party_role', role: 'archivist' }],
      answerMode: 'server_owned_canonical', answerSpecId: 'archive-answer',
    } },
    { id: 'archive-answer', type: 'answer_spec', payload: {
      verifier: 'normalized_exact', acceptedValues: ['bellini'],
    } },
    { id: 'route-puzzle', type: 'puzzle', payload: {
      title: 'The Route That Never Closed', prompt: 'Name the last stop.',
      gates: [{ kind: 'party_role', role: 'driver' }],
      answerMode: 'server_owned_canonical', answerSpecId: 'route-answer',
    } },
    { id: 'route-answer', type: 'answer_spec', payload: {
      verifier: 'normalized_exact', acceptedValues: ['north docks'],
    } },
    { id: 'market-puzzle', type: 'puzzle', payload: {
      title: 'The Sixth Glass', prompt: 'Name the hidden commodity.',
      gates: [{ kind: 'party_role', role: 'broker' }],
      answerMode: 'server_owned_canonical', answerSpecId: 'market-answer',
    } },
    { id: 'market-answer', type: 'answer_spec', payload: {
      verifier: 'normalized_exact', acceptedValues: ['saffron'],
    } },
    { id: 'witness-puzzle', type: 'choice', payload: {
      title: 'Which Memory Is Borrowed?', prompt: 'Choose the borrowed memory.',
      gates: [{ kind: 'party_role', role: 'witness' }], choiceOwnership: 'witness_only',
      recruiterCanOverride: false,
      options: [
        { id: 'blue-room', label: 'The blue room' },
        { id: 'silver-bell', label: 'The silver bell' },
      ],
    } },
    { id: 'supper-photo', type: 'evidence', payload: {
      title: 'Photograph of Six Place Settings', summary: 'Six settings; five names.',
      shareScope: 'party_summary_only',
    } },
    { id: 'vehicle-plate', type: 'evidence', payload: {
      title: 'A Plate Number in the Rain', summary: 'A sedan reached North Docks.',
      shareScope: 'party_summary_only',
    } },
    { id: 'property-deed', type: 'evidence', payload: {
      title: 'A Deed Signed by Nobody', summary: 'Saffron hid a sixth account.',
      shareScope: 'party_summary_only',
    } },
    { id: 'witness-testimony', type: 'evidence', payload: {
      title: 'The Witness Changes One Name', summary: 'The silver bell belonged to Bellini.',
      shareScope: 'party_summary_only',
    } },
    { id: 'four-way-testimony', type: 'human_agent_collaboration', payload: {
      consentRequired: true, uniqueParticipants: true,
      recruiterCannotFillHumanSeat: true, humanChoiceRemainsIndependent: true,
    } },
    { id: 'sixth-family-fact', type: 'world_fact', payload: {
      key: 'history.sixth_family.existed', scope: 'party_instance', value: true,
    } },
    { id: 'party-completion-reward', type: 'reward_bundle', payload: {
      claimOnce: true, cash: 0, tradeableItems: 0,
    } },
    { id: 'sixth-chair-title', type: 'status', payload: {
      title: 'Witness to the Sixth Chair', economicPower: 'none',
    } },
    { id: 'sixth-chair-seal', type: 'collectible_def', payload: {
      title: 'Seal of the Sixth Chair', rarity: 'seasonal_unique', gameplayPower: 'none',
    } },
    { id: 'case-closed', type: 'terminal', payload: {
      title: 'There Were Six', effects: [
        { kind: 'award_status', statusId: 'sixth-chair-title',
          recipientPolicy: 'all_participants', claimPolicy: 'self' },
        { kind: 'award_collectible', collectibleId: 'sixth-chair-seal',
          recipientPolicy: 'all_participants', claimPolicy: 'self' },
      ],
    } },
  ];
  const nodeIds = nodes.map((node) => node.id);
  return {
    schemaVersion: 1,
    namespace: 'omerta.sixth-chair',
    version,
    growth: { role: 'internal_only', exemptReason: 'runtime service fixture' },
    runtime: {
      experienceId: 'the-sixth-chair', entryNodeId: 'the-sixth-chair',
      partyPolicyId: 'crew-policy', quorumId: 'four-seat-quorum',
      terminalNodeId: 'case-closed', nodeIds,
      actionNodeIds: ['archive-puzzle', 'route-puzzle', 'market-puzzle', 'witness-puzzle'],
    },
    nodes,
    edges: [
      { from: 'the-sixth-chair', type: 'REQUIRES', to: 'crew-policy' },
      { from: 'crew-policy', type: 'REQUIRES', to: 'four-seat-quorum' },
      ...['archivist', 'driver', 'broker', 'witness'].map((to) => (
        { from: 'crew-policy', type: 'PERFORMED_BY_ROLE', to }
      )),
      { from: 'the-sixth-chair', type: 'UNLOCKS', to: 'ledger-chapter' },
      ...['archive-puzzle', 'route-puzzle', 'market-puzzle', 'witness-puzzle'].map((to) => (
        { from: 'ledger-chapter', type: 'UNLOCKS', to }
      )),
      { from: 'archive-puzzle', type: 'REVEALS', to: 'supper-photo' },
      { from: 'route-puzzle', type: 'REVEALS', to: 'vehicle-plate' },
      { from: 'market-puzzle', type: 'REVEALS', to: 'property-deed' },
      { from: 'witness-puzzle', type: 'REVEALS', to: 'witness-testimony' },
      { from: 'supper-photo', type: 'CONTRIBUTES_TO', to: 'four-way-testimony' },
      { from: 'vehicle-plate', type: 'CONTRIBUTES_TO', to: 'four-way-testimony' },
      { from: 'property-deed', type: 'CONTRIBUTES_TO', to: 'four-way-testimony' },
      { from: 'witness-testimony', type: 'CONTRIBUTES_TO', to: 'four-way-testimony' },
      ...['archivist', 'driver', 'broker', 'witness'].map((to) => (
        { from: 'four-way-testimony', type: 'PERFORMED_BY_ROLE', to }
      )),
      { from: 'four-way-testimony', type: 'REVEALS', to: 'sixth-family-fact' },
      { from: 'four-way-testimony', type: 'REWARDS', to: 'party-completion-reward' },
      { from: 'party-completion-reward', type: 'UNLOCKS', to: 'case-closed' },
    ],
  };
};

const storyletSource = () => {
  const nodes = [
    { id: 'missed-tide', type: 'mystery', payload: {
      title: 'The Man Who Missed the Tide',
      gates: [{ kind: 'at_location', locationId: 'docks-location' }],
    } },
    { id: 'personal-policy', type: 'party_policy', payload: {
      organizationScopes: ['personal'], uniqueParticipants: true,
      roleLockOnStart: true, recheckConsent: true,
    } },
    { id: 'solo-quorum', type: 'quorum', payload: {
      minimumParticipants: 1, uniqueParticipants: true, minimumOrganizations: 1,
    } },
    { id: 'investigator', type: 'role', payload: {
      title: 'Investigator', participantKinds: ['agent', 'human_eligible_non_agent'],
    } },
    { id: 'docks-location', type: 'location', payload: {
      title: 'The Docks', districtId: 'docks',
    } },
    { id: 'missing-man', type: 'chapter', payload: { title: 'An Empty Berth' } },
    { id: 'manifest-puzzle', type: 'puzzle', payload: {
      title: 'The Salt-Stained Manifest', prompt: 'Which berth was scrubbed from the manifest?',
      gates: [
        { kind: 'party_role', role: 'investigator' },
        { kind: 'at_location', locationId: 'docks-location' },
      ],
      answerMode: 'server_owned_canonical', answerSpecId: 'manifest-answer',
    } },
    { id: 'manifest-answer', type: 'answer_spec', payload: {
      verifier: 'normalized_exact', acceptedValues: ['berth six'],
    } },
    { id: 'tide-choice', type: 'choice', payload: {
      title: 'The Last Launch', prompt: 'Who gets the last place on the launch?',
      gates: [
        { kind: 'party_role', role: 'investigator' },
        { kind: 'at_location', locationId: 'docks-location' },
      ],
      options: [
        { id: 'sailor', label: 'The sailor who missed his tide' },
        { id: 'family', label: 'The family hiding below the pier' },
      ],
    } },
    { id: 'docks-memory', type: 'reward_bundle', payload: {
      claimOnce: true, cash: 0, tradeableItems: 0,
    } },
    { id: 'tide-token', type: 'collectible_def', payload: {
      title: 'Tide-Worn Token', rarity: 'story', gameplayPower: 'none',
    } },
    { id: 'story-closed', type: 'terminal', payload: {
      title: 'The Tide Keeps Its Own Time', effects: [
        { kind: 'award_collectible', collectibleId: 'tide-token',
          recipientPolicy: 'all_participants', claimPolicy: 'self' },
      ],
    } },
  ];
  return {
    schemaVersion: 1,
    namespace: 'omerta.storylet.docks.missed-tide',
    version: 1,
    growth: { role: 'internal_only', exemptReason: 'district storylet runtime fixture' },
    runtime: {
      experienceId: 'missed-tide', entryNodeId: 'missed-tide',
      partyPolicyId: 'personal-policy', quorumId: 'solo-quorum',
      terminalNodeId: 'story-closed', nodeIds: nodes.map((node) => node.id),
      actionNodeIds: ['manifest-puzzle', 'tide-choice'],
    },
    nodes,
    edges: [
      { from: 'missed-tide', type: 'REQUIRES', to: 'personal-policy' },
      { from: 'personal-policy', type: 'REQUIRES', to: 'solo-quorum' },
      { from: 'personal-policy', type: 'PERFORMED_BY_ROLE', to: 'investigator' },
      { from: 'missed-tide', type: 'UNLOCKS', to: 'missing-man' },
      { from: 'missing-man', type: 'UNLOCKS', to: 'manifest-puzzle' },
      { from: 'manifest-puzzle', type: 'UNLOCKS', to: 'tide-choice' },
      { from: 'tide-choice', type: 'UNLOCKS', to: 'docks-memory' },
      { from: 'docks-memory', type: 'UNLOCKS', to: 'story-closed' },
    ],
  };
};

const rankCaseSource = () => {
  const source = structuredClone(storyletSource());
  source.namespace = 'omerta.case.iron-election.runtime-test';
  const root = source.nodes.find((node) => node.id === source.runtime.entryNodeId);
  root.payload.title = 'The Iron Election';
  root.payload.summary = 'Count a Brick Yards ward where every ballot is already owed to somebody.';
  root.payload.systems = ['streets-crime', 'favors', 'street-deeds', 'law'];
  root.payload.gates.push(
    { kind: 'level_at_least', level: 35 },
    { kind: 'path_is', pathId: 'gun' },
  );
  const location = source.nodes.find((node) => node.id === 'docks-location');
  location.payload = { title: 'The Brick Yards', districtId: 'brick' };
  const choice = source.nodes.find((node) => node.id === 'tide-choice');
  choice.payload.title = 'Count the Ward';
  choice.payload.prompt = 'How do you deliver a count the neighborhood will live with?';
  choice.payload.options = [
    { id: 'patient', label: 'Work every doorstep and accept the honest count',
      storyFlagIds: ['iron-patient'] },
    { id: 'expert', label: 'Read the ward through a thief\'s practiced eyes',
      gates: [
        { kind: 'mastery_at_least', trackId: 'gambling', level: 10 },
        { kind: 'skill_owned', skillId: 'executioner' },
        { kind: 'discipline_at_least', disciplineId: 'marksmanship', level: 8 },
        { kind: 'honor_at_least', honor: 25 },
        { kind: 'underworld_standing_at_least', npcId: 'fixer', standing: 25 },
      ],
      storyFlagIds: ['iron-expert'] },
    { id: 'crew', label: 'Ask your crew to keep every ballot box in sight',
      gates: [{ kind: 'crew_membership' }, { kind: 'honor_at_most', honor: -25 }],
      storyFlagIds: ['iron-crew'] },
  ];
  source.nodes.push(
    { id: 'iron-patient', type: 'story_flag', payload: {
      key: 'omerta.case.iron-election.runtime-test.outcome', kind: 'public_reputation',
      value: 'patient', title: 'The Patient Ward', gameplayPower: 'none',
    } },
    { id: 'iron-expert', type: 'story_flag', payload: {
      key: 'omerta.case.iron-election.runtime-test.outcome', kind: 'future_scene_variant',
      value: 'expert', title: 'The Quiet Count', gameplayPower: 'none',
    } },
    { id: 'iron-crew', type: 'story_flag', payload: {
      key: 'omerta.case.iron-election.runtime-test.outcome', kind: 'family_debt',
      value: 'crew', title: 'The Ward Owes the Crew', gameplayPower: 'none',
    } },
  );
  source.runtime.nodeIds.push('iron-patient', 'iron-expert', 'iron-crew');
  const memory = source.nodes.find((node) => node.id === 'tide-token');
  memory.id = 'iron-ballot-stub';
  source.runtime.nodeIds = source.runtime.nodeIds.map((id) => (
    id === 'tide-token' ? 'iron-ballot-stub' : id
  ));
  memory.payload.title = 'Iron Ballot Stub';
  source.nodes.find((node) => node.id === source.runtime.terminalNodeId)
    .payload.effects[0].collectibleId = 'iron-ballot-stub';
  return source;
};

const expectCode = async (code, fn) => {
  await assert.rejects(fn, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
};

const pool = await makeDb();

async function identity(id, name, { agent = false, npc = false } = {}) {
  const characterId = `1${id.slice(1)}`;
  await pool.query(
    'INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$3)',
    [id, 'guest', `subject:${id}`],
  );
  await pool.query(
    'INSERT INTO account_persistent (account_id, agent_flag, npc_flag) VALUES ($1,$2,$3)',
    [id, agent, npc],
  );
  await pool.query(
    `INSERT INTO characters (id, account_id, name, season, is_npc)
     VALUES ($1,$2,$3,1,$4)`,
    [characterId, id, name, npc],
  );
  return { accountId: id, characterId, name };
}

async function as(accountId, fn) {
  return withCharacter(pool, accountId, (ch, client, h) => fn(ch, client, h));
}

async function state(accountId, instanceId) {
  return as(accountId, (ch, client, h) => contentInstanceBoard(ch, instanceId, client, h));
}

const v1 = compileContentPack(packSource(1));
await expectCode('content_hash_mismatch', () => activateContentBundle(pool, {
  bundle: v1, expectedHash: '0'.repeat(64), operatorId: 'operator-a',
}));

const activatedV1 = await activateContentBundle(pool, {
  bundle: v1, expectedHash: v1.contentHash, operatorId: 'operator-a',
});
assert.equal(activatedV1.namespace, v1.namespace);
assert.equal(activatedV1.version, 1);
assert.equal(activatedV1.contentHash, v1.contentHash);

const replayV1 = await activateContentBundle(pool, {
  bundle: v1, expectedHash: v1.contentHash, operatorId: 'operator-a',
});
assert.equal(replayV1.replay, true, 'exact activation is a semantic replay');

const conflictingV1 = compileContentPack(packSource(1, 'A Substituted Chair'));
await expectCode('content_version_conflict', () => activateContentBundle(pool, {
  bundle: conflictingV1, expectedHash: conflictingV1.contentHash, operatorId: 'operator-a',
}));

const agent = await identity('00000000-0000-4000-8000-000000000001', 'Machine Malone', { agent: true });
const driver = await identity('00000000-0000-4000-8000-000000000002', 'Della Wheels');
const broker = await identity('00000000-0000-4000-8000-000000000003', 'Benny Books');
const witness = await identity('00000000-0000-4000-8000-000000000004', 'Willa Bell');
const outsider = await identity('00000000-0000-4000-8000-000000000005', 'Oscar Outside');
const npc = await identity('00000000-0000-4000-8000-000000000006', 'Resident Witness', { npc: true });
const secondAgent = await identity('00000000-0000-4000-8000-000000000007', 'Another Machine', { agent: true });

async function economySnapshot(people) {
  const snapshot = [];
  for (const person of people) {
    const row = (await pool.query(
      `SELECT c.cash, ap.omr FROM characters c
        JOIN account_persistent ap ON ap.account_id=c.account_id
       WHERE c.account_id=$1 AND c.alive`, [person.accountId],
    )).rows[0];
    snapshot.push({ accountId: person.accountId, cash: Number(row.cash), omr: Number(row.omr) });
  }
  return snapshot;
}
const participatingEconomyBefore = await economySnapshot([agent, driver, broker, witness]);

await pool.query(
  'INSERT INTO crews (id, name, leader_account) VALUES ($1,$2,$3)',
  ['crew-six', 'The Sixth Table', agent.accountId],
);
for (const person of [agent, driver, broker, witness, npc, secondAgent]) {
  await pool.query(
    'INSERT INTO crew_members (crew_id, account_id, name) VALUES ($1,$2,$3)',
    ['crew-six', person.accountId, person.name],
  );
}

const catalogue = await as(agent.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.equal(catalogue.experiences.length, 1);
assert.equal(catalogue.experiences[0].namespace, v1.namespace);
assert.equal(JSON.stringify(catalogue).includes('acceptedValues'), false, 'catalog never leaks answers');

const made = await as(agent.accountId, (ch, client, h) => createContentInstance(
  ch, v1.namespace, { scopeKind: 'crew', roleId: 'archivist' }, client, h,
));
const instanceId = made.instance.id;
assert.equal(made.instance.revision, 1);
assert.equal(made.instance.members[0].roleId, 'archivist');

const driverCatalogue = await as(driver.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.equal(driverCatalogue.lobbies.length, 1, 'an eligible organization member discovers the open lobby');
assert.equal(driverCatalogue.lobbies[0].id, instanceId);
assert.equal(driverCatalogue.lobbies[0].openRoles.some((role) => (
  role.id === 'witness' && role.consentRequired
)), true, 'lobby projection identifies roles that require affirmative consent');
assert.equal(JSON.stringify(driverCatalogue.lobbies).includes('scope_id'), false,
  'lobby projections do not expose raw organization authority');
const driverLobby = await state(driver.accountId, instanceId);
assert.equal(driverLobby.instance.openRoles.some((role) => role.id === 'driver'), true,
  'an eligible non-member may refresh the safe lobby projection');
await assert.rejects(
  () => as(driver.accountId, (ch, client, h) => joinContentInstance(
    ch, instanceId, { roleId: 'driver', expectedRevision: 0 }, client, h,
  )),
  (error) => {
    assert.equal(error.code, 'stale_instance');
    assert.equal(error.data?.instance?.id, instanceId, 'stale join returns a safe replacement lobby');
    assert.equal(error.data?.instance?.openRoles.some((role) => role.id === 'driver'), true);
    return true;
  },
);
const outsiderCatalogue = await as(outsider.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.equal(outsiderCatalogue.lobbies.length, 0, 'an outsider cannot discover another organization lobby');
await expectCode('not_member', () => state(outsider.accountId, instanceId));

await expectCode('wrong_organization', () => as(outsider.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'driver', expectedRevision: 1 }, client, h,
)));
await expectCode('participant_kind', () => as(npc.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'witness', consent: true, expectedRevision: 1 }, client, h,
)));
await expectCode('participant_kind', () => as(secondAgent.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'witness', consent: true, expectedRevision: 1 }, client, h,
)));

let board = await state(agent.accountId, instanceId);
await as(driver.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'driver', expectedRevision: board.instance.revision }, client, h,
));
board = await state(agent.accountId, instanceId);
await expectCode('bad_role', () => as(agent.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'broker', expectedRevision: board.instance.revision }, client, h,
)));
await pool.query(
  'INSERT INTO crew_members (crew_id, account_id, name) VALUES ($1,$2,$3)',
  ['crew-six', outsider.accountId, outsider.name],
);
await expectCode('role_taken', () => as(outsider.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'driver', expectedRevision: board.instance.revision }, client, h,
)));
const temporarySeat = await as(outsider.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'broker', expectedRevision: board.instance.revision }, client, h,
));
const left = await as(outsider.accountId, (ch, client, h) => leaveContentInstance(
  ch, instanceId, { expectedRevision: temporarySeat.instance.revision }, client, h,
));
assert.equal(left.left, true, 'a forming member can free their own seat');
board = await state(agent.accountId, instanceId);
await as(broker.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'broker', expectedRevision: board.instance.revision }, client, h,
));
board = await state(agent.accountId, instanceId);
await as(witness.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: 'witness', consent: true, expectedRevision: board.instance.revision }, client, h,
));

board = await state(agent.accountId, instanceId);
assert.equal(board.instance.members.length, 4);
const start = board.instance.actions.find((action) => action.kind === 'start_instance');
assert.ok(start, 'leader receives a server-issued start action after quorum');

await expectCode('stale_instance', () => as(agent.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, { actionId: start.id, expectedRevision: board.instance.revision - 1 }, client, h,
)));
await expectCode('unknown_action', () => as(agent.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, { actionId: 'invented-action', expectedRevision: board.instance.revision }, client, h,
)));

await as(agent.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, { actionId: start.id, expectedRevision: board.instance.revision }, client, h,
));
await assert.rejects(
  () => as(secondAgent.accountId, (ch, client, h) => joinContentInstance(
    ch, instanceId, { roleId: 'driver', expectedRevision: board.instance.revision }, client, h,
  )),
  (error) => {
    assert.equal(error.code, 'stale_instance');
    assert.deepEqual(Object.keys(error.data.instance).sort(), ['id', 'revision', 'status']);
    assert.equal(error.data.instance.status, 'active', 'a just-closed lobby returns a safe stale tombstone');
    return true;
  },
);
board = await state(witness.accountId, instanceId);
assert.equal(board.instance.status, 'active');
assert.equal(JSON.stringify(board).includes('acceptedValues'), false, 'instance board never leaks answers');
assert.equal(JSON.stringify(board).includes(agent.accountId), false, 'instance board never leaks account ids');

const driverBeforeExit = await state(driver.accountId, instanceId);
const routeBeforeExit = driverBeforeExit.instance.actions.find((action) => action.nodeId === 'route-puzzle');
await pool.query('DELETE FROM crew_members WHERE account_id=$1', [driver.accountId]);
await expectCode('wrong_organization', () => state(driver.accountId, instanceId));
const formerMemberBoard = await as(driver.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.equal(formerMemberBoard.instances.some((instance) => instance.id === instanceId), false,
  'a former organization member cannot poll an active party board');
await expectCode('wrong_organization', () => as(driver.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: routeBeforeExit.id, answer: 'north docks',
    expectedRevision: driverBeforeExit.instance.revision,
  }, client, h,
)));
await pool.query(
  'INSERT INTO crew_members (crew_id, account_id, name) VALUES ($1,$2,$3)',
  ['crew-six', driver.accountId, driver.name],
);

await expectCode('already_complete', () => as(driver.accountId, (ch, client, h) => leaveContentInstance(
  ch, instanceId, { expectedRevision: board.instance.revision }, client, h,
)));

await expectCode('consent_not_required', () => as(agent.accountId, (ch, client, h) => setContentConsent(
  ch, instanceId, { consent: true, expectedRevision: board.instance.revision }, client, h,
)));

await as(witness.accountId, (ch, client, h) => setContentConsent(
  ch, instanceId, { consent: false, expectedRevision: board.instance.revision }, client, h,
));
board = await state(agent.accountId, instanceId);
const archive = board.instance.actions.find((action) => action.nodeId === 'archive-puzzle');
await expectCode('consent_required', () => as(agent.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, { actionId: archive.id, answer: 'bellini', expectedRevision: board.instance.revision }, client, h,
)));

await as(witness.accountId, (ch, client, h) => setContentConsent(
  ch, instanceId, { consent: true, expectedRevision: board.instance.revision }, client, h,
));
board = await state(agent.accountId, instanceId);

await expectCode('party_role', () => as(driver.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: board.instance.actions.find((action) => action.nodeId === 'archive-puzzle').id,
    answer: 'bellini', expectedRevision: board.instance.revision,
  }, client, h,
)));
await expectCode('wrong_answer', () => as(agent.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: board.instance.actions.find((action) => action.nodeId === 'archive-puzzle').id,
    answer: 'wrong family', expectedRevision: board.instance.revision,
  }, client, h,
)));

async function solve(accountId, nodeId, input) {
  const before = await state(accountId, instanceId);
  const action = before.instance.actions.find((candidate) => candidate.nodeId === nodeId);
  assert.ok(action, `${nodeId} is issued to its role holder`);
  return as(accountId, (ch, client, h) => actOnContentInstance(
    ch, instanceId, { actionId: action.id, expectedRevision: before.instance.revision, ...input }, client, h,
  ));
}

await solve(agent.accountId, 'archive-puzzle', { answer: '  BeLLiNi  ' });
await solve(driver.accountId, 'route-puzzle', { answer: 'NORTH DOCKS' });
await solve(broker.accountId, 'market-puzzle', { answer: ' saffron ' });

board = await state(agent.accountId, instanceId);
assert.equal(board.instance.status, 'active', 'three contributions do not close the case');
assert.equal(board.instance.facts.length, 0);

await solve(witness.accountId, 'witness-puzzle', { choiceId: 'silver-bell' });
board = await state(agent.accountId, instanceId);
assert.equal(board.instance.status, 'completed');
assert.deepEqual(board.instance.facts, [{ key: 'history.sixth_family.existed', value: true }]);
assert.equal(board.instance.awards.pending, 8, 'two effects are pending for each of four participants');

const nodeCounts = await pool.query(
  'SELECT node_id, COUNT(*) n FROM content_instance_nodes WHERE instance_id=$1 GROUP BY node_id',
  [instanceId],
);
assert.equal(nodeCounts.rows.every((row) => Number(row.n) === 1), true, 'node completion is exact once');
assert.equal(Number((await pool.query(
  'SELECT COUNT(*) n FROM content_instance_facts WHERE instance_id=$1', [instanceId],
)).rows[0].n), 1, 'world fact is exact once');
assert.equal(Number((await pool.query(
  'SELECT COUNT(*) n FROM content_instance_effects WHERE instance_id=$1', [instanceId],
)).rows[0].n), 8, 'terminal effects are exact once');

await expectCode('not_member', () => as(outsider.accountId, (ch, client, h) => claimContentRewards(
  ch, instanceId, { expectedRevision: board.instance.revision }, client, h,
)));

for (const person of [agent, driver, broker, witness]) {
  const before = await state(person.accountId, instanceId);
  const claimed = await as(person.accountId, (ch, client, h) => claimContentRewards(
    ch, instanceId, { expectedRevision: before.instance.revision }, client, h,
  ));
  assert.equal(claimed.claimed.length, 2);
  await expectCode('nothing_to_claim', () => as(person.accountId, (ch, client, h) => claimContentRewards(
    ch, instanceId, { expectedRevision: claimed.instance.revision }, client, h,
  )));
}

const afterClaims = await state(agent.accountId, instanceId);
assert.equal(afterClaims.instance.awards.pending, 0);
assert.equal(afterClaims.instance.awards.applied, 8);
assert.equal((await pool.query(
  'SELECT title FROM characters WHERE account_id=$1 AND alive', [agent.accountId],
)).rows[0].title, 'Witness to the Sixth Chair');
assert.deepEqual(await economySnapshot([agent, driver, broker, witness]), participatingEconomyBefore,
  'the complete authored story changes neither participant cash nor OMR');
await assert.rejects(
  pool.query(
    `INSERT INTO content_instance_effects
       (instance_id,node_id,effect_ordinal,subject_account,kind,target_id,payload_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    ['another-instance', 'another-terminal', 0, agent.accountId, 'award_collectible',
      'sixth-chair-seal', JSON.stringify({ id: 'sixth-chair-seal', title: 'Duplicate Seal' })],
  ),
  (error) => error.code === '23505',
  'logical collectible ownership is unique across instances and content versions',
);
assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), 0,
  'value-neutral runtime never touches the currency ledger');

await expectCode('already_complete', () => as(agent.accountId, (ch, client, h) => createContentInstance(
  ch, v1.namespace, { scopeKind: 'crew', roleId: 'archivist' }, client, h,
)));

const v2 = compileContentPack(packSource(2, 'The Sixth Chair: Pinned Sequel'));
const activatedV2 = await activateContentBundle(pool, {
  bundle: v2, expectedHash: v2.contentHash, operatorId: 'operator-a',
});
assert.equal(activatedV2.version, 2);
await expectCode('content_version_regression', () => activateContentBundle(pool, {
  bundle: v1, expectedHash: v1.contentHash, operatorId: 'operator-a',
}));
const pinned = (await pool.query(
  'SELECT version, content_hash FROM content_instances WHERE id=$1', [instanceId],
)).rows[0];
assert.equal(Number(pinned.version), 1, 'activation rollover does not mutate an existing instance version');
assert.equal(pinned.content_hash, v1.contentHash, 'activation rollover does not mutate an existing instance hash');

const nextRun = await as(agent.accountId, (ch, client, h) => createContentInstance(
  ch, v1.namespace, { scopeKind: 'crew', roleId: 'archivist' }, client, h,
));
assert.equal(nextRun.instance.version, 2, 'a promoted version may open a new exact-version run');

await pool.query(
  'INSERT INTO gangs (id, name, tag, season) VALUES ($1,$2,$3,1)',
  ['family-six', 'The Extended Table', 'EXT'],
);
await pool.query(
  'INSERT INTO gang_members (gang_id, character_id, role) VALUES ($1,$2,$3)',
  ['family-six', outsider.characterId, 'boss'],
);
const familyRun = await as(outsider.accountId, (ch, client, h) => createContentInstance(
  ch, v1.namespace, { scopeKind: 'extended_family', roleId: 'archivist' }, client, h,
));
assert.equal(familyRun.instance.scopeKind, 'extended_family', 'Family scope is derived from the actor');
const abandoned = await as(outsider.accountId, (ch, client, h) => leaveContentInstance(
  ch, familyRun.instance.id, { expectedRevision: familyRun.instance.revision }, client, h,
));
assert.equal(abandoned.instance.status, 'abandoned', 'the lobby creator leaving abandons the run');

const allHuman = [];
for (let index = 8; index <= 11; index++) {
  allHuman.push(await identity(
    `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    `Human Seat ${index}`,
  ));
}
await pool.query(
  'INSERT INTO crews (id, name, leader_account) VALUES ($1,$2,$3)',
  ['crew-all-human', 'The Human Table', allHuman[0].accountId],
);
for (const person of allHuman) {
  await pool.query(
    'INSERT INTO crew_members (crew_id, account_id, name) VALUES ($1,$2,$3)',
    ['crew-all-human', person.accountId, person.name],
  );
}
let humanRun = await as(allHuman[0].accountId, (ch, client, h) => createContentInstance(
  ch, v1.namespace, { scopeKind: 'crew', roleId: 'archivist' }, client, h,
));
for (const [person, roleId, consent] of [
  [allHuman[1], 'driver', false], [allHuman[2], 'broker', false], [allHuman[3], 'witness', true],
]) {
  humanRun = await as(person.accountId, (ch, client, h) => joinContentInstance(
    ch, humanRun.instance.id, {
      roleId, consent, expectedRevision: humanRun.instance.revision,
    }, client, h,
  ));
}
const humanLeaderBoard = await state(allHuman[0].accountId, humanRun.instance.id);
const humanStart = humanLeaderBoard.instance.actions.find((action) => action.kind === 'start_instance');
await expectCode('participant_mix', () => as(allHuman[0].accountId, (ch, client, h) => actOnContentInstance(
  ch, humanRun.instance.id, {
    actionId: humanStart.id, expectedRevision: humanLeaderBoard.instance.revision,
  }, client, h,
)));
assert.equal((await state(allHuman[0].accountId, humanRun.instance.id)).instance.status, 'forming',
  'a collaboration cannot start without an actual agent participant');

// The first authored drop adds short, solo, district-bound graphs. Personal scope remains tied to
// the living street, action gates are rechecked after travel, and graph edges reveal one stage at a
// time instead of issuing the entire story at once.
const solo = await identity('00000000-0000-4000-8000-000000000012', 'Solo Mariner');
const storylet = compileContentPack(storyletSource());
await activateContentBundle(pool, {
  bundle: storylet, expectedHash: storylet.contentHash, operatorId: 'operator-a',
});
await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [solo.characterId, 'neon']);
let soloBoard = await as(solo.accountId, (ch, client, h) => contentBoard(ch, client, h));
const listedStorylet = soloBoard.experiences.find((entry) => entry.namespace === storylet.namespace);
assert.deepEqual(listedStorylet.location, {
  id: 'docks-location', districtId: 'docks', title: 'The Docks',
}, 'the content board publishes the authored district gate without leaking private answers');
assert.equal(listedStorylet.availableHere, false, 'a district storylet is visible but not startable elsewhere');
await expectCode('wrong_location', () => as(solo.accountId, (ch, client, h) => createContentInstance(
  ch, storylet.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h,
)));

await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [solo.characterId, 'docks']);
soloBoard = await as(solo.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.equal(soloBoard.experiences.find((entry) => entry.namespace === storylet.namespace).availableHere,
  true, 'arrival in the authored district opens the storylet');
let soloRun = await as(solo.accountId, (ch, client, h) => createContentInstance(
  ch, storylet.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h,
));
assert.equal(soloRun.instance.scopeKind, 'personal', 'personal scope is derived from the living street');
assert.equal(soloRun.instance.members.length, 1, 'a solo storylet has exactly one self-owned role');
assert.deepEqual(soloRun.instance.actions.map((action) => action.kind), ['start_instance'],
  'the solo creator receives the normal revision-bound start action');
await expectCode('not_member', () => state(outsider.accountId, soloRun.instance.id));

soloRun = await as(solo.accountId, (ch, client, h) => actOnContentInstance(
  ch, soloRun.instance.id, {
    actionId: soloRun.instance.actions[0].id, expectedRevision: soloRun.instance.revision,
  }, client, h,
));
assert.deepEqual(soloRun.instance.actions.map((action) => action.nodeId), ['manifest-puzzle'],
  'the chapter reveals only its first authored action');
const issuedPuzzle = soloRun.instance.actions[0];
await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [solo.characterId, 'neon']);
assert.equal((await state(solo.accountId, soloRun.instance.id)).instance.actions.length, 0,
  'leaving the district hides the gated action without mutating story progress');
await expectCode('wrong_location', () => as(solo.accountId, (ch, client, h) => actOnContentInstance(
  ch, soloRun.instance.id, {
    actionId: issuedPuzzle.id, expectedRevision: soloRun.instance.revision, answer: 'berth six',
  }, client, h,
)));

await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [solo.characterId, 'docks']);
soloRun = await state(solo.accountId, soloRun.instance.id);
soloRun = await as(solo.accountId, (ch, client, h) => actOnContentInstance(
  ch, soloRun.instance.id, {
    actionId: soloRun.instance.actions[0].id, expectedRevision: soloRun.instance.revision,
    answer: '  BERTH SIX  ',
  }, client, h,
));
assert.deepEqual(soloRun.instance.actions.map((action) => action.nodeId), ['tide-choice'],
  'solving stage one unlocks only stage two');
soloRun = await as(solo.accountId, (ch, client, h) => actOnContentInstance(
  ch, soloRun.instance.id, {
    actionId: soloRun.instance.actions[0].id, expectedRevision: soloRun.instance.revision,
    choiceId: 'family',
  }, client, h,
));
assert.equal(soloRun.instance.status, 'completed', 'the final choice closes the sequential storylet');
assert.equal(soloRun.instance.awards.pending, 1, 'the storylet creates one gameplay-inert memento');
const soloClaim = await as(solo.accountId, (ch, client, h) => claimContentRewards(
  ch, soloRun.instance.id, { expectedRevision: soloRun.instance.revision }, client, h,
));
assert.deepEqual(soloClaim.claimed, [{
  kind: 'award_collectible', id: 'tide-token', title: 'Tide-Worn Token',
}], 'the personal story memory is exact-once and value-neutral');
await expectCode('already_complete', () => as(solo.accountId, (ch, client, h) => createContentInstance(
  ch, storylet.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h,
)));

// Don cases are visible before a street qualifies, but rank/build/social gates remain server-owned.
// A selected outcome records one durable, account-scoped narrative fact in the same transaction as
// the choice; neither the fact nor its memento can mint cash, OMR, mastery, or ledger activity.
const ranker = await identity('00000000-0000-4000-8000-000000000013', 'Ward Counter');
const rankCase = compileContentPack(rankCaseSource());
await activateContentBundle(pool, {
  bundle: rankCase, expectedHash: rankCase.contentHash, operatorId: 'operator-a',
});
await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [ranker.characterId, 'brick']);
let rankBoard = await as(ranker.accountId, (ch, client, h) => contentBoard(ch, client, h));
let listedRankCase = rankBoard.experiences.find((entry) => entry.namespace === rankCase.namespace);
assert.equal(listedRankCase.availableHere, true, 'the rank case is standing in its authored district');
assert.equal(listedRankCase.eligible, false, 'an under-level street can discover but cannot open the case');
assert.deepEqual(listedRankCase.blockedBy, [
  { kind: 'level_at_least', label: 'Level requirement', passed: false, current: 1, required: 35 },
  { kind: 'path_is', label: 'The Gun Path', passed: false, pathId: 'gun', title: 'The Gun',
    current: null, required: 'gun' },
], 'discovery explains bounded rank and Path requirements without exposing private content');
assert.deepEqual(listedRankCase.systems, ['streets-crime', 'favors', 'street-deeds', 'law'],
  'the board advertises the existing systems the case reconnects');
await expectCode('level', () => as(ranker.accountId, (ch, client, h) => createContentInstance(
  ch, rankCase.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h,
)));
assert.equal(Number((await pool.query(
  'SELECT COUNT(*) n FROM content_instances WHERE namespace=$1', [rankCase.namespace],
)).rows[0].n), 0, 'a failed root gate leaves no partial instance or membership behind');

await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [
  ranker.characterId, PACING.LEVEL_DIVISOR * (35 - 1) ** 2,
]);
rankBoard = await as(ranker.accountId, (ch, client, h) => contentBoard(ch, client, h));
listedRankCase = rankBoard.experiences.find((entry) => entry.namespace === rankCase.namespace);
assert.equal(listedRankCase.eligible, false, 'rank alone cannot open a case written for another identity');
assert.deepEqual(listedRankCase.blockedBy, [{
  kind: 'path_is', label: 'The Gun Path', passed: false, pathId: 'gun', title: 'The Gun',
  current: null, required: 'gun',
}], 'discovery names the canonical Path without exposing private content internals');
await expectCode('content_gate', () => as(ranker.accountId, (ch, client, h) => createContentInstance(
  ch, rankCase.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h,
)));
await pool.query('UPDATE characters SET path=$2 WHERE id=$1', [ranker.characterId, 'gun']);
rankBoard = await as(ranker.accountId, (ch, client, h) => contentBoard(ch, client, h));
listedRankCase = rankBoard.experiences.find((entry) => entry.namespace === rankCase.namespace);
assert.equal(listedRankCase.eligible, true, 'meeting the rank gate opens the authored case');
assert.deepEqual(listedRankCase.blockedBy, [], 'passed gates do not clutter the blocker list');

const economyBefore = (await pool.query(
  `SELECT c.cash, ap.omr, (SELECT COUNT(*) FROM transactions) AS tx_count
     FROM characters c JOIN account_persistent ap ON ap.account_id=c.account_id
    WHERE c.id=$1`, [ranker.characterId],
)).rows[0];
let rankRun = await as(ranker.accountId, (ch, client, h) => createContentInstance(
  ch, rankCase.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h,
));
rankRun = await as(ranker.accountId, (ch, client, h) => actOnContentInstance(
  ch, rankRun.instance.id, {
    actionId: rankRun.instance.actions[0].id, expectedRevision: rankRun.instance.revision,
  }, client, h,
));
rankRun = await as(ranker.accountId, (ch, client, h) => actOnContentInstance(
  ch, rankRun.instance.id, {
    actionId: rankRun.instance.actions[0].id, expectedRevision: rankRun.instance.revision,
    answer: 'berth six',
  }, client, h,
));
let rankChoiceAction = rankRun.instance.actions[0];
assert.deepEqual(rankChoiceAction.options.map(({ id, available }) => ({ id, available })), [
  { id: 'patient', available: true },
  { id: 'expert', available: false },
  { id: 'crew', available: false },
], 'the choice keeps a baseline route while explaining unavailable build and social approaches');
assert.deepEqual(rankChoiceAction.options.find((option) => option.id === 'expert').blockedBy, [{
  kind: 'mastery_at_least', label: 'The Gambler mastery', passed: false,
  trackId: 'gambling', title: 'The Gambler',
  current: 1, required: 10,
}, {
  kind: 'skill_owned', label: 'Executioner skill', passed: false,
  skillId: 'executioner', title: 'Executioner', current: false, required: true,
}, {
  kind: 'discipline_at_least', label: 'The Range discipline', passed: false,
  disciplineId: 'marksmanship', title: 'The Range', current: 1, required: 8,
}, {
  kind: 'honor_at_least', label: 'Honor 25 or higher', passed: false,
  current: 0, required: 25,
}, {
  kind: 'underworld_standing_at_least', label: 'Vinnie the Match standing', passed: false,
  npcId: 'fixer', title: 'Vinnie the Match', current: 0, required: 25,
}], 'the mastery route publishes only the canonical track and current threshold');
assert.deepEqual(rankChoiceAction.options.find((option) => option.id === 'crew').blockedBy, [
  { kind: 'crew_membership', label: 'Crew membership', passed: false, current: false, required: true },
  { kind: 'honor_at_most', label: 'Honor -25 or lower', passed: false, current: 0, required: -25 },
], 'the optional social route explains its crew and Infamy requirements');
const lockedRevision = rankRun.instance.revision;
await expectCode('content_gate', () => as(ranker.accountId, (ch, client, h) => actOnContentInstance(
  ch, rankRun.instance.id, {
    actionId: rankChoiceAction.id, expectedRevision: lockedRevision, choiceId: 'expert',
  }, client, h,
)));
rankRun = await state(ranker.accountId, rankRun.instance.id);
assert.equal(rankRun.instance.revision, lockedRevision,
  'a crafted locked-option request cannot advance the instance revision');
assert.equal(rankRun.instance.nodes.find((node) => node.id === 'tide-choice').state, 'available',
  'a rejected locked option leaves the choice unresolved');

await pool.query('UPDATE characters SET honor=-25 WHERE id=$1', [ranker.characterId]);
rankRun = await state(ranker.accountId, rankRun.instance.id);
assert.deepEqual(rankRun.instance.actions[0].options.find((option) => option.id === 'crew').blockedBy, [{
  kind: 'crew_membership', label: 'Crew membership', passed: false, current: false, required: true,
}], 'the runtime re-evaluates an Infamy ceiling from the current locked street');

await pool.query(
  'INSERT INTO masteries (character_id, track_id, xp) VALUES ($1,$2,$3)',
  [ranker.characterId, 'gambling', masteryXpFor(10)],
);
await pool.query(
  'INSERT INTO character_skills (character_id, skill_id) VALUES ($1,$2)',
  [ranker.characterId, 'executioner'],
);
await pool.query(
  'INSERT INTO character_disciplines (character_id, discipline, xp) VALUES ($1,$2,$3)',
  [ranker.characterId, 'marksmanship', REGIMEN.XP_DIVISOR * (8 - 1) ** 2],
);
await pool.query('UPDATE characters SET honor=25 WHERE id=$1', [ranker.characterId]);
await pool.query(
  'INSERT INTO npc_standing (character_id, npc_id, standing, touched_at) VALUES ($1,$2,$3,now())',
  [ranker.characterId, 'fixer', 25],
);
rankRun = await state(ranker.accountId, rankRun.instance.id);
rankChoiceAction = rankRun.instance.actions[0];
assert.equal(rankChoiceAction.options.find((option) => option.id === 'expert').available, true,
  'the server re-evaluates the current street build instead of trusting the old projection');
rankRun = await as(ranker.accountId, (ch, client, h) => actOnContentInstance(
  ch, rankRun.instance.id, {
    actionId: rankChoiceAction.id, expectedRevision: rankRun.instance.revision, choiceId: 'expert',
  }, client, h,
));
assert.equal(rankRun.instance.status, 'completed', 'the qualified authored route completes normally');
const storyFlag = (await pool.query(
  'SELECT * FROM content_story_flags WHERE account_id=$1', [ranker.accountId],
)).rows[0];
assert.deepEqual({
  key: storyFlag.flag_key, kind: storyFlag.flag_kind, value: storyFlag.flag_value,
  title: storyFlag.title, namespace: storyFlag.source_namespace,
  version: Number(storyFlag.source_version), instanceId: storyFlag.source_instance_id,
  nodeId: storyFlag.source_node_id, choiceId: storyFlag.source_choice_id,
}, {
  key: 'omerta.case.iron-election.runtime-test.outcome', kind: 'future_scene_variant',
  value: 'expert', title: 'The Quiet Count', namespace: rankCase.namespace,
  version: 1, instanceId: rankRun.instance.id, nodeId: 'tide-choice', choiceId: 'expert',
}, 'the chosen graph node records exact immutable provenance for future authored scenes');
rankBoard = await as(ranker.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.deepEqual(rankBoard.storyFlags.map(({ recordedAt, ...flag }) => flag), [{
  key: 'omerta.case.iron-election.runtime-test.outcome', kind: 'future_scene_variant',
  value: 'expert', title: 'The Quiet Count',
}], 'the caller sees a safe narrative-memory projection without source internals');
const rankClaim = await as(ranker.accountId, (ch, client, h) => claimContentRewards(
  ch, rankRun.instance.id, { expectedRevision: rankRun.instance.revision }, client, h,
));
assert.deepEqual(rankClaim.claimed, [{
  kind: 'award_collectible', id: 'iron-ballot-stub', title: 'Iron Ballot Stub',
}], 'the Don case grants only its gameplay-inert authored memento');
const economyAfter = (await pool.query(
  `SELECT c.cash, ap.omr, (SELECT COUNT(*) FROM transactions) AS tx_count
     FROM characters c JOIN account_persistent ap ON ap.account_id=c.account_id
    WHERE c.id=$1`, [ranker.characterId],
)).rows[0];
assert.deepEqual(economyAfter, economyBefore,
  'rank cases and story flags create no cash, OMR, or transaction-ledger movement');
assert.equal(Number((await pool.query(
  'SELECT xp FROM masteries WHERE character_id=$1 AND track_id=$2',
  [ranker.characterId, 'gambling'],
)).rows[0].xp), masteryXpFor(10), 'authored choices cannot mutate the mastery used to qualify');

console.log('✓ content runtime pins bundles, enforces party authority, resolves the graph, and claims value-neutral rewards exactly once');
await pool.end();
