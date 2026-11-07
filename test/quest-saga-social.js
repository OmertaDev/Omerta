import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { QUEST_SAGA_PACKS } from '../src/content/quest-saga.js';
import { compileContentPack } from '../src/content/compiler.js';
import { activateContentBundle, actOnContentInstance, addContentCaseNote, contentBoard,
  contentInstanceBoard, createContentInstance, joinContentInstance, releaseContentRole } from '../src/content/runtime.js';

const pool = await makeDb(), packs = new Map(QUEST_SAGA_PACKS.map(pack => [pack.runtime.experienceId, pack]));
const as = (person, fn) => withCharacter(pool, person.accountId, fn);
const read = (person, id) => as(person, (ch, client, h) => contentInstanceBoard(ch, id, client, h));
const mutate = (person, board, fn, input = {}) => as(person, (ch, client, h) => fn(ch, board.instance.id,
  { expectedRevision: board.instance.revision, ...input }, client, h));
const act = (person, board, action, input) => mutate(person, board, actOnContentInstance, { actionId: action.id, ...input });
async function identity(name) {
  const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'guest', accountId]);
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
  await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, name]);
  return { accountId, characterId, name };
}
async function crew(id, members) {
  await pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [id, id, members[0].accountId]);
  for (const member of members) await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [id, member.accountId, member.name]);
}
async function start(person, name, scopeKind, roleId, invitedAccountIds) {
  return as(person, (ch, client, h) => createContentInstance(ch, packs.get(name).namespace,
    { scopeKind, roleId, invitedAccountIds, consent: true, agendaConsent: true }, client, h));
}
async function solve(person, board, action, choice) {
  if (action.kind === 'start_instance') return act(person, board, action, {});
  if (action.kind === 'choose') return act(person, board, action, { choiceId: choice || action.options.find(option => option.available).id });
  const pack = packs.get(board.instance.experienceId), node = pack.nodes.find(node => node.id === action.nodeId);
  const spec = pack.nodes.find(candidate => candidate.id === node.payload.answerSpecId).payload;
  return act(person, board, action, { submission: spec.verifier === 'mapping' ? { assignments: spec.solution } : { ids: spec.solution } });
}
async function finish(people, id, choices = {}) {
  const visited = new Set(); let board;
  for (let step = 0; step < 40; step++) {
    let progressed = false;
    for (const person of people) {
      board = await read(person, id);
      if (board.instance.status === 'completed') return { board, visited };
      const action = board.instance.actions[0];
      if (!action) continue;
      visited.add(action.nodeId); board = await solve(person, board, action, choices[action.nodeId]); progressed = true;
    }
    assert(progressed, 'the social graph has a satisfiable next contribution');
  }
  assert.fail('social graph did not terminate');
}

try {
  for (const name of ['sixth-envelope', 'rival-accord']) {
    const bundle = compileContentPack(packs.get(name));
    await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
  }
  const clerk = await identity('Envelope Clerk'), courier = await identity('Envelope Courier'), replacement = await identity('Envelope Replacement');
  const delegate = await identity('Rival Delegate'), outsider = await identity('Uninvited Observer');
  await crew('envelope-home', [clerk, courier, replacement]); await crew('envelope-rival', [delegate, outsider]);
  let board = await start(clerk, 'sixth-envelope', 'crew', 'clerk');
  const id = board.instance.id;
  await assert.rejects(() => mutate(courier, board, joinContentInstance, { roleId: 'courier', consent: true }), error => error.code === 'agenda_consent_required');
  board = await mutate(courier, board, joinContentInstance, { roleId: 'courier', consent: true, agendaConsent: true });
  board = await read(clerk, id); board = await solve(clerk, board, board.instance.actions[0]);
  assert(!JSON.stringify(board).includes('Your private door map'), 'Q32: the clerk cannot read the courier\'s private map');
  assert(!JSON.stringify(board).includes('Your witness asked'), 'Q33: another participant\'s objective stays private');
  board = await solve(clerk, board, board.instance.actions[0]);
  assert(board.instance.nodes.some(node => node.id === 'private-manifest'));
  assert(!(await read(courier, id)).instance.nodes.some(node => node.id === 'private-manifest'));
  board = await mutate(clerk, board, addContentCaseNote, { text: 'The envelope bears a triangle seal; blue names only its wrapping.' });
  const actorBefore = (await pool.query('SELECT actor_account FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [id, 'manifest'])).rows[0].actor_account;
  await mutate(clerk, board, releaseContentRole);
  const releasedView = await read(clerk, id);
  assert.equal(releasedView.instance.notes, undefined, 'released members can see an open-seat lobby but no private case notes');
  await assert.rejects(() => mutate(clerk, releasedView, addContentCaseNote, { text: 'An old membership grants no write authority.' }), error => error.code === 'not_member');
  board = await read(replacement, id);
  board = await mutate(replacement, board, joinContentInstance, { roleId: 'clerk', consent: true, agendaConsent: true });
  assert.match(board.instance.notes[0].text, /triangle seal/, 'Q34: shared asynchronous interpretation survives role replacement');
  assert.equal((await pool.query('SELECT actor_account FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [id, 'manifest'])).rows[0].actor_account, actorBefore);
  const completed = await finish([replacement, courier], id, { 'clerk-oath': 'preserve', 'courier-oath': 'anonymous' });
  assert(completed.visited.has('combined-route'));
  assert.equal(completed.board.instance.debrief.length, 2);
  assert(completed.board.instance.debrief.every(entry => entry.completed), 'Q33: actual selected objectives determine the completion debrief');
  for (const [offer, response, expected] of [['public', 'counter', 'reconcile'], ['sealed', 'accept', 'sealed-close']]) {
    board = await start(clerk, 'rival-accord', 'invitation', 'mediator', [delegate.accountId]);
    const rivalId = board.instance.id;
    assert((await as(delegate, contentBoard)).lobbies.some(lobby => lobby.id === rivalId));
    assert(!(await as(outsider, contentBoard)).lobbies.some(lobby => lobby.id === rivalId));
    await assert.rejects(() => mutate(outsider, board, joinContentInstance, { roleId: 'delegate', consent: true }), error => error.code === 'wrong_organization');
    await assert.rejects(() => mutate(delegate, board, joinContentInstance, { roleId: 'delegate' }), error => error.code === 'consent_required');
    board = await mutate(delegate, board, joinContentInstance, { roleId: 'delegate', consent: true });
    board = await read(clerk, rivalId); board = await solve(clerk, board, board.instance.actions[0]);
    const result = await finish([clerk, delegate], rivalId, { offer, 'public-response': response, 'sealed-response': response });
    assert(result.visited.has(expected), 'Q35: the other organization\'s acceptance or counteroffer changes the playable settlement');
    assert(!result.visited.has(offer === 'public' ? 'sealed-response' : 'public-response'));
  }
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n), 0);
  console.log('quest social saga: private complementary evidence, opted-in objectives, asynchronous notes, self-handoff, actual rival settlements and value-neutrality passed');
} finally { await pool.end(); }
