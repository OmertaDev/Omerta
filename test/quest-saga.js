import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { QUEST_SAGA_PACKS } from '../src/content/quest-saga.js';
import { compileContentPack } from '../src/content/compiler.js';
import { narrativeVariant } from '../src/content/narrative.js';
import { questingBoard, readingRoomExercise, submitReadingRoom } from '../src/questing.js';
import { activateContentBundle, actOnContentInstance, claimContentRewards, contentBoard, contentInstanceBoard, createContentInstance } from '../src/content/runtime.js';

const pool = await makeDb();
const packs = new Map(QUEST_SAGA_PACKS.map(pack => [pack.runtime.experienceId, pack]));
const as = (who, fn) => withCharacter(pool, who.accountId, fn);
async function identity(name) {
  const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'guest', accountId]);
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
  await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, name]);
  return { accountId, characterId };
}
async function start(who, name) {
  let board = await as(who, (ch, client, h) => createContentInstance(ch, packs.get(name).namespace,
    { scopeKind: 'personal', roleId: 'investigator' }, client, h));
  const action = board.instance.actions.find(action => action.kind === 'start_instance');
  assert(action, 'a complete solo quorum issues a start action');
  return act(who, board, action, {});
}
async function act(who, board, action, input) {
  return as(who, (ch, client, h) => actOnContentInstance(ch, board.instance.id,
    { expectedRevision: board.instance.revision, actionId: action.id, ...input }, client, h));
}
function solution(pack, board, action) {
  const node = pack.nodes.find(node => node.id === action.nodeId);
  const payload = narrativeVariant(node, board.instance.id);
  const spec = pack.nodes.find(node => node.id === payload.answerSpecId).payload;
  return spec.verifier === 'mapping' ? { submission: { assignments: spec.solution } }
    : spec.verifier === 'normalized_exact' ? { answer: spec.acceptedValues[0] } : { submission: { ids: spec.solution } };
}
async function finish(who, name, choices = {}, { fail = [], board: existing, replaceAt } = {}) {
  const pack = packs.get(name); let board = existing || await start(who, name);
  const visited = new Set(); let replacement;
  for (let step = 0; board.instance.status === 'active' && step < 60; step++) {
    assert.equal(JSON.stringify(board).includes('"solution"'), false, 'Q07: server answer specifications remain private');
    const action = board.instance.actions[0]; assert(action, `${name} has no satisfiable next action`);
    visited.add(action.nodeId);
    if (replaceAt === action.nodeId && !replacement) {
      await pool.query('UPDATE characters SET alive=false WHERE id=$1', [who.characterId]);
      replacement = crypto.randomUUID();
      await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [replacement, who.accountId, `Heir ${who.accountId.slice(0, 8)}`]);
      who.characterId = replacement;
      const resumed = await as(who, (ch, client, h) => contentInstanceBoard(ch, board.instance.id, client, h));
      assert.equal(resumed.instance.revision, board.instance.revision, 'Q24/Q30: replacing a character preserves authoritative case progress');
      assert.deepEqual(resumed.instance.journal, board.instance.journal);
      board = resumed;
    }
    if (fail.includes(action.nodeId)) {
      const wrong = action.interaction.items.find(item => !solution(pack, board, action).submission.ids.includes(item.id));
      assert(wrong, 'failure scenario must use a real issued but incorrect item');
      board = await act(who, board, action, { submission: { ids: [wrong.id] } });
      continue;
    }
    if (action.kind === 'choose') {
      const picked = action.options.find(option => option.id === choices[action.nodeId]) || action.options.find(option => option.available);
      assert(picked?.available, `selected ${name}/${action.nodeId} branch is available`);
      board = await act(who, board, action, { choiceId: picked.id });
    } else board = await act(who, board, action, solution(pack, board, action));
  }
  assert.equal(board.instance.status, 'completed', `${name} reaches a terminal within bounded play`);
  assert(board.instance.journal.length > 1, 'Q28: completed reasoning is retained in the case file');
  assert(board.instance.expectations.durationMinutes > 0, 'Q31: every case exposes expectations');
  return { board, visited };
}

try {
  for (const pack of QUEST_SAGA_PACKS) {
    const bundle = compileContentPack(pack);
    await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
  }
  const alice = await identity('Saga Witness'), bob = await identity('Saga Archivist'), stranger = await identity('New Caseworker');
  const balances = await pool.query('SELECT account_id,cash FROM characters');
  let discovery = await as(alice, contentBoard);
  assert.equal(discovery.experiences.find(row => row.namespace === packs.get('missing-name').namespace).eligible, false,
    'Q01: the larger conspiracy opens through a completed earlier case');
  const opening = await start(alice, 'early-obituary');
  const first = opening.instance.actions[0];
  const hinted = await act(alice, opening, first, { hint: true });
  assert.equal(hinted.instance.actions[0].hints.length, 1);
  assert.equal(hinted.instance.actions[0].attempts, 0, 'Q29: hints do not penalize or solve the case');
  const publicCase = await finish(alice, 'early-obituary', { approach: 'witness', protection: 'public' }, { board: hinted });
  assert(publicCase.visited.has('compositor') && !publicCase.visited.has('delivery'), 'Q08/Q12: the witness approach has its own playable investigation');
  const quietCase = await finish(bob, 'early-obituary', { approach: 'records', protection: 'quiet' }, { fail: ['safe-route'] });
  assert(quietCase.visited.has('delivery') && !quietCase.visited.has('compositor'));
  assert(quietCase.visited.has('negotiated-exit'), 'Q13: failed preparation opens a playable recovery scene');
  discovery = await as(alice, contentBoard);
  assert.equal(discovery.experiences.find(row => row.namespace === packs.get('archive-service').namespace).eligible, false,
    'Q27: unclaimed mementos do not unlock a witness service');
  await as(alice, (ch, client, h) => claimContentRewards(ch, publicCase.board.instance.id, { expectedRevision: publicCase.board.instance.revision }, client, h));
  discovery = await as(alice, contentBoard);
  assert.equal(discovery.experiences.find(row => row.namespace === packs.get('archive-service').namespace).eligible, true);
  await finish(alice, 'family-dinner', { kindness: 'doorman', 'last-toast': 'friend' });
  await finish(bob, 'family-dinner', { kindness: 'ada', 'last-toast': 'business' });
  const recovered = await finish(alice, 'missing-name', { method: 'friend', countermove: 'public', identity: 'privacy' });
  assert(recovered.visited.has('daughter') && recovered.visited.has('originals-rule'), 'Q02/Q20/Q21: remembered relationships and exposure alter later investigations');
  assert(recovered.visited.has('identify'), 'Q38: the omitted worker is identified by a submitted inference with independent corroboration');
  const archived = await finish(bob, 'missing-name', { method: 'archive', countermove: 'quiet', identity: 'letter' });
  assert(archived.visited.has('archive') && archived.visited.has('watched-delivery'));
  await finish(alice, 'three-witnesses'); await finish(bob, 'three-witnesses');
  const band = await finish(alice, 'quiet-wedding', { cover: 'band', rescue: 'ordinary' });
  const noisy = await finish(bob, 'quiet-wedding', { cover: 'flowers' }, { fail: ['flower-cover-test'] });
  assert(band.visited.has('band-inspection') && !band.visited.has('flower-inspection'), 'Q10/Q39: the chosen equipment preparation changes execution and the scene inspection');
  assert(noisy.visited.has('flower-inspection') && !noisy.visited.has('band-inspection'));
  assert(noisy.visited.has('flower-usher-talk') && noisy.board.instance.suspicion === 2, 'Q16: suspicion opens the selected cover\'s recovery scene');
  const afterPublic = await finish(alice, 'morning-after', { return: 'public', friendship: 'listen' });
  const afterQuiet = await finish(bob, 'morning-after', { return: 'quiet' });
  assert(afterPublic.visited.has('reopened') && afterQuiet.visited.has('shuttered'), 'Q22/Q23: the epilogue plays the actual earlier aftermath');
  await finish(alice, 'inherited-file', {}, { replaceAt: 'reconstruct' });
  await finish(alice, 'archive-service');
  const casework = await as(alice, questingBoard);
  assert(casework.reputation.distinctCases >= 8 && casework.reputation.categories.includes('Legacy'), 'Q26: distinct account accomplishments persist after character replacement');
  assert(casework.relationships.some(row => row.name === 'Ada Vale' && row.state === 'Trusted friend'));
  assert.equal(casework.districtScenes[0].scope, 'personal');
  assert.match(casework.nemesis.response, /originals/, 'Q02: Orsini remembers exposure');
  const exercise = casework.services[0].exercise;
  assert(exercise && !JSON.stringify(exercise).includes('solution'), 'Q25: earned reading-room access exposes a playable service without its answer');
  await assert.rejects(() => as(stranger, (ch, client) => submitReadingRoom(ch, { exerciseId: exercise.id, ids: [] }, client)), error => error.code === 'quest_service_locked');
  await assert.rejects(() => as(alice, (ch, client) => submitReadingRoom(ch, { exerciseId: 'old', ids: [] }, client)), error => error.code === 'stale_exercise');
  const privateExercise = readingRoomExercise(alice.accountId);
  assert.deepEqual(privateExercise, readingRoomExercise(alice.accountId), 'Q19: an issued daily exercise remains stable across reconnects');
  let practice = await as(alice, (ch, client) => submitReadingRoom(ch, { exerciseId: exercise.id, ids: privateExercise.solution }, client));
  assert(practice.solved);
  practice = await as(alice, (ch, client) => submitReadingRoom(ch, { exerciseId: exercise.id, ids: privateExercise.solution }, client));
  assert(practice.alreadySolved, 'completed exercises do not replay effects');
  const after = await pool.query('SELECT account_id,cash FROM characters');
  for (const old of balances.rows) assert.equal(after.rows.find(row => row.account_id === old.account_id).cash, old.cash, 'quest content does not mint cash');
  assert.equal((await pool.query("SELECT COUNT(*) AS n FROM transactions WHERE reason LIKE 'quest:%'")).rows[0].n, 0);
  console.log('quest saga: connected branches, evidence, timelines, item use, social relationships, remembered consequences, pressure/recovery, legacy, mementos, services and value-neutrality passed');
} finally { await pool.end(); }
