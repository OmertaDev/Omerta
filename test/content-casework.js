import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import Ajv from 'ajv';
import { buildOpenApi } from '../src/agentgateway.js';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { compileContentPack } from '../src/content/compiler.js';
import {
  activateContentBundle, actOnContentInstance, addContentCaseNote, contentBoard,
  contentInstanceBoard, createContentInstance, joinContentInstance, releaseContentRole,
} from '../src/content/runtime.js';

const source = JSON.parse(fs.readFileSync(new URL('../content/packs/two-man-rule/pack.json', import.meta.url), 'utf8'));
source.namespace = 'test.casework.cross-organization';
const byId = new Map(source.nodes.map((node) => [node.id, node]));
Object.assign(byId.get(source.runtime.partyPolicyId).payload, {
  organizationScopes: ['invitation'], invitation: { organizationKind: 'crew', maxInvitees: 3 }, allowRoleReplacement: true,
});
byId.get(source.runtime.quorumId).payload.minimumOrganizations = 2;
byId.get('watcher').payload.privateAgenda = { prompt: 'Keep the missing door off the public record.', consentRequired: true, completionNodeId: 'watch-the-corridor' };
byId.get('signatory').payload.privateAgenda = { prompt: 'Leave a complete copy in the archive.', consentRequired: true, completionNodeId: 'turn-the-keys', choiceId: byId.get('turn-the-keys').payload.options[0].id };
byId.get('watch-the-corridor').payload.prompt = 'Inspect the unique CORRIDOR-ONLY trace.';
byId.get('read-the-counterseal').payload.prompt = 'Inspect the unique COUNTERSEAL-ONLY trace.';
source.nodes.push(
  { id: 'corridor-fragment', type: 'evidence', payload: { title: 'Corridor Fragment', summary: 'The first half is 47.', shareScope: 'role_private', roleId: 'watcher', evidenceKind: 'confirmed' } },
  { id: 'counterseal-fragment', type: 'evidence', payload: { title: 'Counterseal Fragment', summary: 'The second half is 09.', shareScope: 'role_private', roleId: 'signatory', evidenceKind: 'confirmed' } },
);
source.runtime.nodeIds.push('corridor-fragment', 'counterseal-fragment');
source.edges.push(
  { from: 'watch-the-corridor', type: 'REVEALS', to: 'corridor-fragment' },
  { from: 'read-the-counterseal', type: 'REVEALS', to: 'counterseal-fragment' },
);
const pool = await makeDb();
const receiptSchema = new Ajv({ strict: false, validateFormats: false, allowUnionTypes: true }).compile({
  components: buildOpenApi([]).components, $ref: '#/components/schemas/ContentReceipt',
});
const publicReceipt = value => {
  assert.equal(receiptSchema(JSON.parse(JSON.stringify(value))), true, JSON.stringify(receiptSchema.errors));
  return value;
};
const people = [];
async function identity(name) {
  const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'guest', accountId]);
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
  await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, name]);
  const who = { accountId, characterId, name }; people.push(who); return who;
}
const as = (who, fn) => withCharacter(pool, who.accountId, fn);
const board = async (who, instanceId) => publicReceipt(await as(who, (ch, client, h) => contentInstanceBoard(ch, instanceId, client, h)));
const mutate = async (who, run, fn, input) => publicReceipt(await as(who, (ch, client, h) => fn(ch, run.instance.id, { expectedRevision: run.instance.revision, ...input }, client, h)));
const act = (who, run, input) => mutate(who, run, actOnContentInstance, { actionId: run.instance.actions[0].id, ...input });
const create = (who, invitedAccountIds, extra = {}) => as(who, (ch, client, h) => createContentInstance(ch, source.namespace, {
  scopeKind: 'invitation', roleId: 'watcher', consent: true, agendaConsent: true, invitedAccountIds, ...extra,
}, client, h));
const first = await identity('First Crew Watcher'), second = await identity('Other Crew Signatory');
const reserve = await identity('Replacement Watcher'), outsider = await identity('Uninvited Reader');
for (const [crewId, leader, members] of [['casework-a', first, [first, reserve]], ['casework-b', second, [second, outsider]]]) {
  await pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [crewId, crewId, leader.accountId]);
  for (const member of members) await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [crewId, member.accountId, member.name]);
}
const bundle = compileContentPack(source);
await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
await assert.rejects(() => create(first, [second.accountId], { consent: false }), (error) => error.code === 'consent_required');
await assert.rejects(() => create(first, [second.accountId], { agendaConsent: false }), (error) => error.code === 'agenda_consent_required');
await assert.rejects(() => create(first, [reserve.accountId]), (error) => error.code === 'quorum');
let run = await create(first, [second.accountId, reserve.accountId]);
const instanceId = run.instance.id;
const discoveries = await as(second, contentBoard);
assert.ok(discoveries.lobbies.some((lobby) => lobby.id === instanceId), 'an invitation is discoverable only by its allowed account');
assert.ok(!(await as(outsider, contentBoard)).lobbies.some((lobby) => lobby.id === instanceId));
await assert.rejects(() => board(outsider, instanceId), (error) => error.code === 'not_member');
await assert.rejects(() => mutate(second, run, joinContentInstance, { roleId: 'signatory' }), (error) => error.code === 'consent_required');
run = await mutate(second, run, joinContentInstance, { roleId: 'signatory', consent: true, agendaConsent: true });
run = await board(first, instanceId); run = await act(first, run, {});
assert.ok(JSON.stringify(run).includes('CORRIDOR-ONLY'));
assert.ok(!JSON.stringify(run).includes('COUNTERSEAL-ONLY'), 'foreign role puzzle text stays private');
assert.ok(!JSON.stringify(run).includes('Leave a complete copy'), 'foreign agenda stays private');
const secondRun = await board(second, instanceId);
assert.ok(!JSON.stringify(secondRun).includes('CORRIDOR-ONLY'));
assert.ok(!JSON.stringify(secondRun).includes('Keep the missing door'));
const watcherAnswer = byId.get(byId.get('watch-the-corridor').payload.answerSpecId).payload.acceptedValues[0];
run = await act(first, run, { answer: watcherAnswer });
assert.ok(run.instance.nodes.some((node) => node.id === 'corridor-fragment'));
assert.ok(!(await board(second, instanceId)).instance.nodes.some((node) => node.id === 'corridor-fragment'), 'completed complementary evidence stays private until deliberately shared');
run = await mutate(first, run, addContentCaseNote, { text: 'My fragment reads 47.' });
assert.equal((await board(second, instanceId)).instance.notes[0].text, 'My fragment reads 47.');
await assert.rejects(() => mutate(outsider, run, addContentCaseNote, { text: 'I should not see this.' }), (error) => error.code === 'not_member');
const completedBefore = (await pool.query('SELECT actor_account FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [instanceId, 'watch-the-corridor'])).rows[0];
const released = await mutate(first, run, releaseContentRole, {});
assert.equal(released.released, true);
await assert.rejects(() => mutate(first, released, addContentCaseNote, { text: 'Old access' }), (error) => error.code === 'not_member');
let lobby = await board(reserve, instanceId);
assert.ok(lobby.instance.openRoles.some((role) => role.id === 'watcher'));
run = await mutate(reserve, lobby, joinContentInstance, { roleId: 'watcher', consent: true, agendaConsent: true });
assert.deepEqual((await pool.query('SELECT actor_account FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [instanceId, 'watch-the-corridor'])).rows[0], completedBefore, 'handoff preserves completed actor provenance');
assert.equal(run.instance.notes[0].text, 'My fragment reads 47.', 'asynchronous case notes survive replacement');
const audit = (await pool.query('SELECT fact_key FROM content_instance_facts WHERE instance_id=$1 AND fact_key LIKE $2', [instanceId, 'runtime.handoff:%'])).rows;
assert.equal(audit.length, 2, 'release and replacement both leave append-only audit facts');
assert.ok(run.instance.facts.every((fact) => !fact.key.startsWith('runtime.')), 'private invitation tuples and handoff account IDs are not public facts');
await pool.query('DELETE FROM crew_members WHERE account_id=$1', [second.accountId]);
const reserveState = await board(reserve, instanceId);
await assert.rejects(() => as(reserve, (ch, client, h) => actOnContentInstance(ch, instanceId, {
  expectedRevision: reserveState.instance.revision,
  actionId: `content_${crypto.createHash('sha256').update(`${instanceId}\0${reserveState.instance.revision}\0puzzle\0read-the-counterseal`).digest('hex').slice(0, 24)}`,
  answer: 'anything',
}, client, h)), (error) => error.code === 'wrong_organization', 'every active contribution rechecks the other participant’s pinned organization');
await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', ['casework-b', second.accountId, second.name]);
run = await board(second, instanceId);
const signatoryAnswer = byId.get(byId.get('read-the-counterseal').payload.answerSpecId).payload.acceptedValues[0];
run = await act(second, run, { answer: signatoryAnswer });
run = await act(second, run, { choiceId: byId.get('turn-the-keys').payload.options[0].id });
assert.equal(run.instance.status, 'completed');
assert.equal(run.instance.debrief.length, 2);
assert.ok(run.instance.debrief.every((entry) => entry.completed), 'completed case reveals each opted-in objective and its actual result');
assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n), 0);
console.log('✓ casework protects complementary evidence and private objectives, coordinates notes and self-handoffs, and binds rival invitations to consent and current organizations');
await pool.end();
