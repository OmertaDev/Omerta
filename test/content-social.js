// THE TWO-MAN RULE — focused authored-content social runtime contract.
//
// This suite keeps organization play distinct from the agent/human collaboration primitive: either
// seat may be human or agent-controlled, but two unique members of the same Crew or Extended Family
// must complete independent role-locked branches before the shared verdict becomes actionable.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContentPack } from '../src/content/compiler.js';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import {
  activateContentBundle,
  actOnContentInstance,
  claimContentRewards,
  contentBoard,
  contentInstanceBoard,
  createContentInstance,
  joinContentInstance,
} from '../src/content/runtime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = path.join(ROOT, 'content', 'packs', 'two-man-rule', 'pack.json');
const NAMESPACE = 'omerta.case.organization.two-man-rule';
const TITLE = 'The Two-Man Rule';

assert.equal(fs.existsSync(PACK_PATH), true, 'The Two-Man Rule source pack must exist');
const source = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
const nodeById = new Map(source.nodes.map((node) => [node.id, node]));
const runtimeIds = new Set(source.runtime.nodeIds);
const runtimeNodes = source.nodes.filter((node) => runtimeIds.has(node.id));
const runtimeEdges = source.edges.filter((edge) => runtimeIds.has(edge.from) && runtimeIds.has(edge.to));

assert.equal(source.namespace, NAMESPACE, 'the organization case keeps its stable namespace');
assert.equal(nodeById.get(source.runtime.entryNodeId)?.payload?.title, TITLE,
  'the organization case keeps its public title');

const policy = nodeById.get(source.runtime.partyPolicyId);
const quorum = nodeById.get(source.runtime.quorumId);
assert.deepEqual([...policy.payload.organizationScopes].sort(), ['crew', 'extended_family'],
  'only Crew and Extended Family scopes may open the case');
assert.deepEqual({
  minimumParticipants: quorum.payload.minimumParticipants,
  uniqueParticipants: quorum.payload.uniqueParticipants,
  minimumOrganizations: quorum.payload.minimumOrganizations,
}, {
  minimumParticipants: 2,
  uniqueParticipants: true,
  minimumOrganizations: 1,
}, 'the case requires exactly the two unique organization seats');

const roleIds = runtimeEdges
  .filter((edge) => edge.from === policy.id && edge.type === 'PERFORMED_BY_ROLE')
  .map((edge) => edge.to);
assert.equal(roleIds.length, 2, 'the party policy exposes exactly two roles');
for (const roleId of roleIds) {
  const role = nodeById.get(roleId);
  assert.equal(role.type, 'role');
  assert.deepEqual([...role.payload.participantKinds].sort(), ['agent', 'human_eligible_non_agent'],
    `${roleId} accepts both supported player participant kinds`);
}
assert.equal(source.nodes.some((node) => node.type === 'human_agent_collaboration'), false,
  'The Two-Man Rule is organization cooperation, not a forced agent/human collaboration');

const actionNodes = source.runtime.actionNodeIds.map((id) => nodeById.get(id));
assert.equal(actionNodes.every(Boolean), true, 'every runtime action ID resolves to a node');
for (const node of actionNodes) {
  assert.deepEqual(node.payload.gates?.map((gate) => gate.kind), ['party_role'],
    `${node.id} has exactly one party_role gate`);
  assert.equal(roleIds.includes(node.payload.gates[0].role), true,
    `${node.id} belongs to one of the two declared roles`);
}

const finalChoice = actionNodes.find((node) => node.type === 'choice');
assert.ok(finalChoice, 'the case has one final choice');
assert.equal(actionNodes.filter((node) => node.type === 'choice').length, 1,
  'the case has exactly one final choice');
assert.equal(finalChoice.payload.options.length, 3, 'the final choice exposes exactly three options');
assert.equal(new Set(finalChoice.payload.options.map((option) => option.id)).size, 3,
  'the final option IDs are unique');
for (const option of finalChoice.payload.options) {
  assert.match(option.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'final option IDs are stable canonical IDs');
  assert.equal(typeof option.label, 'string');
  assert.notEqual(option.label.trim(), '', 'every final option has a stable visible label');
}
const finalInputs = runtimeEdges
  .filter((edge) => edge.type === 'UNLOCKS' && edge.to === finalChoice.id)
  .map((edge) => nodeById.get(edge.from));
assert.equal(finalInputs.length, 2, 'both parallel branches feed the final choice');
assert.equal(finalInputs.every((node) => actionNodes.includes(node)), true,
  'each final prerequisite is an executable branch action');
assert.deepEqual(new Set(finalInputs.map((node) => node.payload.gates[0].role)), new Set(roleIds),
  'the two final prerequisites come from different role-owned branches');

const rewardBundles = source.nodes.filter((node) => node.type === 'reward_bundle');
assert.equal(rewardBundles.length, 1, 'the case has one value-neutral reward bundle');
assert.equal(rewardBundles[0].payload.cash, 0);
assert.equal(rewardBundles[0].payload.tradeableItems, 0);
assert.equal(source.nodes.some((node) => [
  'funded_omr_allocation', 'agent_recruitment_reward', 'item_def', 'recipe', 'source', 'sink',
  'status',
].includes(node.type)), false, 'the complete pack contains no economy or power adapter');
const collectibles = source.nodes.filter((node) => node.type === 'collectible_def');
assert.equal(collectibles.length, 1, 'the case defines one collectible');
assert.equal(collectibles[0].payload.gameplayPower, 'none', 'the collectible is gameplay-inert');
const terminal = nodeById.get(source.runtime.terminalNodeId);
assert.deepEqual(terminal.payload.effects, [{
  kind: 'award_collectible',
  collectibleId: collectibles[0].id,
  recipientPolicy: 'all_participants',
  claimPolicy: 'self',
}], 'the terminal creates one self-claim collectible entitlement for every participant');

const bundle = compileContentPack(source);
const pool = await makeDb();

const expectCode = async (code, fn) => {
  await assert.rejects(fn, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
};

async function identity(id, name, { agent = false } = {}) {
  const characterId = `1${id.slice(1)}`;
  await pool.query(
    'INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$3)',
    [id, 'guest', `subject:${id}`],
  );
  await pool.query(
    'INSERT INTO account_persistent (account_id, agent_flag) VALUES ($1,$2)',
    [id, agent],
  );
  await pool.query(
    'INSERT INTO characters (id, account_id, name, season) VALUES ($1,$2,$3,1)',
    [characterId, id, name],
  );
  return { accountId: id, characterId, name };
}

async function as(accountId, fn) {
  return withCharacter(pool, accountId, (ch, client, h) => fn(ch, client, h));
}

async function state(accountId, instanceId) {
  return as(accountId, (ch, client, h) => contentInstanceBoard(ch, instanceId, client, h));
}

const actionIdentity = (instance, kind, nodeId = '') => `content_${crypto.createHash('sha256')
  .update(`${instance.id}\0${Number(instance.revision)}\0${kind}\0${nodeId}`)
  .digest('hex').slice(0, 24)}`;

async function economySnapshot(people) {
  const accounts = [];
  for (const person of people) {
    const row = (await pool.query(
      `SELECT c.cash, ap.omr FROM characters c
        JOIN account_persistent ap ON ap.account_id=c.account_id
       WHERE c.account_id=$1 AND c.alive`, [person.accountId],
    )).rows[0];
    accounts.push({ accountId: person.accountId, cash: Number(row.cash), omr: Number(row.omr) });
  }
  const transactions = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  return { accounts, transactions };
}

await activateContentBundle(pool, {
  bundle, expectedHash: bundle.contentHash, operatorId: 'content-social-test',
});

const leader = await identity('20000000-0000-4000-8000-000000000001', 'Nora Watch');
const partner = await identity('20000000-0000-4000-8000-000000000002', 'Sam Sign');
const crewThird = await identity('20000000-0000-4000-8000-000000000003', 'Rita Reserve', { agent: true });
const outsider = await identity('20000000-0000-4000-8000-000000000004', 'Owen Outside');
const familyBoss = await identity('20000000-0000-4000-8000-000000000005', 'Faye Family');
const familyPartner = await identity('20000000-0000-4000-8000-000000000006', 'Eddie Extended', { agent: true });

await pool.query(
  'INSERT INTO crews (id, name, leader_account) VALUES ($1,$2,$3)',
  ['crew-two-man', 'The Double Lock', leader.accountId],
);
for (const person of [leader, partner, crewThird]) {
  await pool.query(
    'INSERT INTO crew_members (crew_id, account_id, name) VALUES ($1,$2,$3)',
    ['crew-two-man', person.accountId, person.name],
  );
}

const catalogue = await as(leader.accountId, (ch, client, h) => contentBoard(ch, client, h));
const listed = catalogue.experiences.find((entry) => entry.namespace === NAMESPACE);
assert.equal(listed.title, TITLE);
assert.deepEqual([...listed.scopes].sort(), ['crew', 'extended_family']);
assert.equal(listed.roles.length, 2);

let run = await as(leader.accountId, (ch, client, h) => createContentInstance(
  ch, NAMESPACE, { scopeKind: 'crew', roleId: roleIds[0] }, client, h,
));
const instanceId = run.instance.id;
assert.equal(run.instance.scopeKind, 'crew');
assert.equal(run.instance.members.length, 1);
assert.equal(run.instance.actions.some((action) => action.kind === 'start_instance'), false,
  'a solo creator is not issued a start action');
await expectCode('quorum', () => as(leader.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: actionIdentity(run.instance, 'start_instance'), expectedRevision: run.instance.revision,
  }, client, h,
)));

await expectCode('bad_role', () => as(leader.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: roleIds[1], expectedRevision: run.instance.revision }, client, h,
)));
await expectCode('role_taken', () => as(crewThird.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: roleIds[0], expectedRevision: run.instance.revision }, client, h,
)));
await expectCode('wrong_organization', () => as(outsider.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: roleIds[1], expectedRevision: run.instance.revision }, client, h,
)));

run = await as(partner.accountId, (ch, client, h) => joinContentInstance(
  ch, instanceId, { roleId: roleIds[1], expectedRevision: run.instance.revision }, client, h,
));
assert.deepEqual(new Set(run.instance.members.map((member) => member.roleId)), new Set(roleIds));
assert.equal(run.instance.members.every((member) => member.participantKind === 'human_eligible_non_agent'), true,
  'an all-human Crew may fill both flexible seats');

let leaderState = await state(leader.accountId, instanceId);
const start = leaderState.instance.actions.find((action) => action.kind === 'start_instance');
assert.ok(start, 'the creator receives start authority when both seats are filled');
const economyBefore = await economySnapshot([leader, partner]);
run = await as(leader.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, { actionId: start.id, expectedRevision: leaderState.instance.revision }, client, h,
));
assert.equal(run.instance.status, 'active', 'two humans in one Crew can start the case');

leaderState = await state(leader.accountId, instanceId);
let partnerState = await state(partner.accountId, instanceId);
assert.deepEqual(leaderState.instance.actions.map((action) => action.nodeId), [finalInputs.find(
  (node) => node.payload.gates[0].role === roleIds[0],
)?.id], 'the creator sees only their role-owned opening branch action');
assert.deepEqual(partnerState.instance.actions.map((action) => action.nodeId), [finalInputs.find(
  (node) => node.payload.gates[0].role === roleIds[1],
)?.id], 'the partner sees only their role-owned opening branch action');

const leaderBranch = leaderState.instance.actions[0];
await expectCode('party_role', () => as(partner.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: leaderBranch.id,
    answer: nodeById.get(nodeById.get(leaderBranch.nodeId).payload.answerSpecId).payload.acceptedValues[0],
    expectedRevision: leaderState.instance.revision,
  }, client, h,
)));

const leaderPuzzle = nodeById.get(leaderBranch.nodeId);
run = await as(leader.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: leaderBranch.id,
    answer: nodeById.get(leaderPuzzle.payload.answerSpecId).payload.acceptedValues[0],
    expectedRevision: leaderState.instance.revision,
  }, client, h,
));
assert.equal(run.instance.actions.some((action) => action.nodeId === finalChoice.id), false,
  'one completed branch cannot unlock the shared finale');
partnerState = await state(partner.accountId, instanceId);
assert.equal(partnerState.instance.actions.some((action) => action.nodeId === finalChoice.id), false,
  'the finale remains unavailable to both roles until both branches complete');

const partnerBranch = partnerState.instance.actions.find((action) => action.nodeId !== finalChoice.id);
const partnerPuzzle = nodeById.get(partnerBranch.nodeId);
run = await as(partner.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: partnerBranch.id,
    answer: nodeById.get(partnerPuzzle.payload.answerSpecId).payload.acceptedValues[0],
    expectedRevision: partnerState.instance.revision,
  }, client, h,
));

const finalRole = finalChoice.payload.gates[0].role;
const finalActor = finalRole === roleIds[0] ? leader : partner;
const wrongFinalActor = finalRole === roleIds[0] ? partner : leader;
const finalState = await state(finalActor.accountId, instanceId);
const finalAction = finalState.instance.actions.find((action) => action.nodeId === finalChoice.id);
assert.ok(finalAction, 'both completed branches unlock the shared finale for its assigned role');
assert.equal((await state(wrongFinalActor.accountId, instanceId)).instance.actions
  .some((action) => action.nodeId === finalChoice.id), false,
  'the other role is not issued the final action');
await expectCode('party_role', () => as(wrongFinalActor.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: finalAction.id,
    choiceId: finalChoice.payload.options[0].id,
    expectedRevision: finalState.instance.revision,
  }, client, h,
)));

run = await as(finalActor.accountId, (ch, client, h) => actOnContentInstance(
  ch, instanceId, {
    actionId: finalAction.id,
    choiceId: finalChoice.payload.options[0].id,
    expectedRevision: finalState.instance.revision,
  }, client, h,
));
assert.equal(run.instance.status, 'completed');
assert.equal(run.instance.awards.pending, 2, 'one entitlement is pending for each participant');
const entitlementRows = (await pool.query(
  `SELECT subject_account, COUNT(*)::int n FROM content_instance_effects
    WHERE instance_id=$1 GROUP BY subject_account ORDER BY subject_account`, [instanceId],
)).rows;
assert.deepEqual(entitlementRows.map((row) => Number(row.n)), [1, 1],
  'the database contains exactly one entitlement per participant');

for (const person of [leader, partner]) {
  const beforeClaim = await state(person.accountId, instanceId);
  const claimed = await as(person.accountId, (ch, client, h) => claimContentRewards(
    ch, instanceId, { expectedRevision: beforeClaim.instance.revision }, client, h,
  ));
  assert.deepEqual(claimed.claimed, [{
    kind: 'award_collectible', id: collectibles[0].id, title: collectibles[0].payload.title,
  }], 'each participant self-claims the one inert collectible');
  await expectCode('nothing_to_claim', () => as(person.accountId, (ch, client, h) => claimContentRewards(
    ch, instanceId, { expectedRevision: claimed.instance.revision }, client, h,
  )));
}
assert.deepEqual(await economySnapshot([leader, partner]), economyBefore,
  'the full two-player run and both claims move no cash, OMR, or transaction rows');

await pool.query(
  'INSERT INTO gangs (id, name, tag, season) VALUES ($1,$2,$3,1)',
  ['family-two-man', 'The Counterseal Family', 'CSF'],
);
await pool.query(
  'INSERT INTO gang_members (gang_id, character_id, role) VALUES ($1,$2,$3),($1,$4,$5)',
  ['family-two-man', familyBoss.characterId, 'boss', familyPartner.characterId, 'soldier'],
);
const familyRun = await as(familyBoss.accountId, (ch, client, h) => createContentInstance(
  ch, NAMESPACE, { scopeKind: 'extended_family', roleId: roleIds[0] }, client, h,
));
assert.equal(familyRun.instance.scopeKind, 'extended_family');
const familyRow = (await pool.query(
  'SELECT scope_kind, scope_id FROM content_instances WHERE id=$1', [familyRun.instance.id],
)).rows[0];
assert.deepEqual(familyRow, { scope_kind: 'extended_family', scope_id: 'family-two-man' },
  'Extended Family authority is derived from server membership, never a client-supplied family ID');
const familyCatalogue = await as(familyPartner.accountId, (ch, client, h) => contentBoard(ch, client, h));
assert.equal(familyCatalogue.lobbies.some((lobby) => lobby.id === familyRun.instance.id), true,
  'another current Family member discovers the server-derived organization lobby');

console.log('✓ The Two-Man Rule enforces two-seat organization authority, parallel role branches, and exact-once value-neutral claims');
await pool.end();
