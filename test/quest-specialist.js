// Q15: an actual shipped investigation branch depends on the current character's
// canonical mastery, never client fields, another street, or the account legend.
import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { QUEST_SAGA_PACKS } from '../src/content/quest-saga.js';
import { compileContentPack } from '../src/content/compiler.js';
import { narrativeVariant } from '../src/content/narrative.js';
import { activateContentBundle } from '../src/content/runtime.js';
import { masteryLvlOf, masteryXpFor } from '../src/rules.js';

assert(!process.env.DATABASE_URL, 'Specialist quest verification uses disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const packs = new Map(QUEST_SAGA_PACKS.map((pack) => [pack.runtime.experienceId, pack]));
const missing = packs.get('missing-name');
const method = missing.nodes.find((node) => node.id === 'method');
const gate = method.payload.options.find((option) => option.id === 'specialist').gates.find((entry) => entry.kind === 'mastery_at_least');
assert(gate.level > masteryLvlOf(0), 'the specialist threshold must exclude a fresh street');
const threshold = masteryXpFor(gate.level);
assert.equal(masteryLvlOf(threshold), gate.level);
assert.equal(masteryLvlOf(threshold - 1), gate.level - 1);

const app = await buildServer();
const pool = app.pool;
const request = async (method, path, token, body) => {
  const reply = await app.inject({ method, url: path, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  return { code: reply.statusCode, body: reply.json() };
};
const ok = async (...args) => {
  const reply = await request(...args); assert.equal(reply.code, 200, `${args[0]} ${args[1]}: ${JSON.stringify(reply.body)}`); return reply.body;
};
async function create(name) {
  const { token } = await ok('POST', '/v1/auth/guest');
  await ok('POST', '/v1/character', token, { name });
  const character = (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0];
  return { token, character };
}
const read = (who, id) => ok('GET', `/v1/content/instances/${id}`, who.token);
const move = (who, board, action, input) => ok('POST', `/v1/content/instances/${board.instance.id}/act`, who.token,
  { expectedRevision: board.instance.revision, actionId: action.id, ...input });
function solution(pack, board, action) {
  const node = pack.nodes.find((entry) => entry.id === action.nodeId);
  const payload = narrativeVariant(node, board.instance.id);
  const answer = pack.nodes.find((entry) => entry.id === payload.answerSpecId).payload;
  return answer.verifier === 'mapping' ? { submission: { assignments: answer.solution } }
    : answer.verifier === 'normalized_exact' ? { answer: answer.acceptedValues[0] }
      : { submission: { ids: answer.solution } };
}
async function start(who, name) {
  const board = await ok('POST', `/v1/content/${packs.get(name).namespace}/instances`, who.token,
    { scopeKind: 'personal', roleId: 'investigator' });
  const action = board.instance.actions.find((entry) => entry.kind === 'start_instance');
  assert(action); return move(who, board, action, {});
}
async function advance(who, name, board, stopAt = null) {
  const pack = packs.get(name), visited = new Set();
  for (let step = 0; board.instance.status === 'active' && step < 60; step++) {
    const action = board.instance.actions[0]; assert(action, `${name} must have a playable next move`);
    if (action.nodeId === stopAt) return { board, visited };
    visited.add(action.nodeId);
    const input = action.kind === 'choose'
      ? { choiceId: action.options.find((option) => option.available).id }
      : solution(pack, board, action);
    board = await move(who, board, action, input);
  }
  assert.equal(board.instance.status, 'completed');
  return { board, visited };
}
const specialist = (board) => board.instance.actions.find((action) => action.nodeId === 'method').options.find((option) => option.id === 'specialist');
const setXp = (who, xp) => pool.query(`INSERT INTO masteries (character_id,track_id,xp) VALUES ($1,$2,$3)
  ON CONFLICT (character_id,track_id) DO UPDATE SET xp=EXCLUDED.xp`, [who.character.id, gate.trackId, xp]);

try {
  for (const name of ['early-obituary', 'missing-name']) {
    const bundle = compileContentPack(packs.get(name));
    await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
  }
  const novice = await create('Specialist Untrained'), trained = await create('Specialist Trained');
  for (const who of [novice, trained]) await advance(who, 'early-obituary', await start(who, 'early-obituary'));
  let noviceBoard = (await advance(novice, 'missing-name', await start(novice, 'missing-name'), 'method')).board;
  let trainedBoard = (await advance(trained, 'missing-name', await start(trained, 'missing-name'), 'method')).board;
  assert.equal(specialist(noviceBoard).available, false, 'fresh mastery cannot unlock specialist investigation');
  assert.equal(specialist(noviceBoard).blockedBy[0].current, masteryLvlOf(0));
  assert.equal(specialist(noviceBoard).blockedBy[0].required, gate.level);

  // A lifetime status record and another player's trained street confer no authority.
  await pool.query('INSERT INTO mastery_legend (account_id,track_id,xp) VALUES ($1,$2,$3)', [novice.character.account_id, gate.trackId, threshold * 100]);
  await setXp(trained, threshold);
  noviceBoard = await read(novice, noviceBoard.instance.id);
  assert.equal(specialist(noviceBoard).available, false, 'account legend and a different character cannot satisfy the current character gate');
  const noviceAction = noviceBoard.instance.actions.find((action) => action.nodeId === 'method');
  const choiceInput = { expectedRevision: noviceBoard.instance.revision, actionId: noviceAction.id, choiceId: 'specialist' };
  const denied = await request('POST', `/v1/content/instances/${noviceBoard.instance.id}/act`, novice.token, choiceInput);
  assert.equal(denied.code, 400);
  assert.equal(denied.body.error, 'content_gate', 'the server rechecks the specialist choice rather than trusting availability UI');
  for (const forged of [
    { mastery: { [gate.trackId]: threshold } }, { owned: { mastery: { [gate.trackId]: threshold } } },
    { characterId: trained.character.id }, { accountId: trained.character.account_id },
  ]) {
    const response = await request('POST', `/v1/content/instances/${noviceBoard.instance.id}/act`, novice.token, { ...choiceInput, ...forged });
    assert.equal(response.code, 400, 'raw body authority additions are rejected');
  }
  const unchanged = await read(novice, noviceBoard.instance.id);
  assert.equal(unchanged.instance.revision, noviceBoard.instance.revision, 'refused and forged choices cannot progress or change the case');
  assert.equal(specialist(unchanged).available, false);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM masteries WHERE character_id=$1', [novice.character.id])).rows[0].n), 0,
    'forged mastery never creates canonical XP');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM content_story_flags WHERE account_id=$1 AND flag_key=$2',
    [novice.character.account_id, 'omerta.quest.missing-name.method'])).rows[0].n), 0, 'denied selection cannot record a specialist story flag');

  // Boundary behavior is checked against the actual canonical XP curve.
  await setXp(trained, threshold - 1);
  trainedBoard = await read(trained, trainedBoard.instance.id);
  assert.equal(specialist(trainedBoard).available, false, 'one XP below threshold is still gated');
  const nearAction = trainedBoard.instance.actions.find((action) => action.nodeId === 'method');
  const nearDenied = await request('POST', `/v1/content/instances/${trainedBoard.instance.id}/act`, trained.token,
    { expectedRevision: trainedBoard.instance.revision, actionId: nearAction.id, choiceId: 'specialist' });
  assert.equal(nearDenied.body.error, 'content_gate');
  await setXp(trained, threshold);
  trainedBoard = await read(trained, trainedBoard.instance.id);
  assert.equal(specialist(trainedBoard).available, true, 'the exact required canonical mastery unlocks the option');
  const qualifiedAction = trainedBoard.instance.actions.find((action) => action.nodeId === 'method');
  trainedBoard = await move(trained, trainedBoard, qualifiedAction, { choiceId: 'specialist' });
  assert(trainedBoard.instance.actions.some((action) => action.nodeId === 'impressions'), 'the selected option opens its own playable investigation');
  assert(!trainedBoard.instance.actions.some((action) => ['archive', 'daughter'].includes(action.nodeId)), 'other methods are not silently executed');
  const specialized = await advance(trained, 'missing-name', trainedBoard);
  assert(specialized.visited.has('impressions'));
  assert(!specialized.visited.has('archive') && !specialized.visited.has('daughter'));
  assert.equal(specialized.board.instance.status, 'completed');
  const xpAfter = Number((await pool.query('SELECT xp FROM masteries WHERE character_id=$1 AND track_id=$2', [trained.character.id, gate.trackId])).rows[0].xp);
  assert.equal(xpAfter, threshold, 'the scene reads mastery without granting, spending or fabricating XP');

  // Non-specialists retain a real alternative route through the complete case.
  noviceBoard = await move(novice, unchanged, noviceAction, { choiceId: 'archive' });
  const ordinary = await advance(novice, 'missing-name', noviceBoard);
  assert(ordinary.visited.has('archive') && !ordinary.visited.has('impressions'));
  assert.equal(ordinary.board.instance.status, 'completed');
  console.log(`quest specialist: mastery level ${gate.level} boundaries, canonical character isolation, forged authority refusal, distinct specialist traversal and ordinary fallback passed`);
} finally { await app.close(); }
