import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../../src/db.js';
import { withCharacter } from '../../src/game.js';
import { compileContentPack } from '../../src/content/compiler.js';
import { narrativeVariant } from '../../src/content/narrative.js';
import { QUEST_QUALITY_PACKS } from '../../src/content/quest-quality-packs.js';
import { activateContentBundle, actOnContentInstance, actOnContentQuality, contentInstanceBoard, createContentInstance } from '../../src/content/runtime.js';

export async function qualityFixture({ native = false, pool: providedPool } = {}) {
  if (!native) assert(!process.env.DATABASE_URL, 'Quality tests use disposable pg-mem; native tests require an owned database.');
  const pool = providedPool || await makeDb();
  const packs = new Map(QUEST_QUALITY_PACKS.map(pack => [pack.runtime.experienceId, pack]));
  for (const pack of packs.values()) {
    const bundle = compileContentPack(pack);
    await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
  }
  const as = (who, fn) => withCharacter(pool, who.accountId, fn);
  const identity = async name => {
    const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
    await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'guest', accountId]);
    await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
    await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, name]);
    return { accountId, characterId };
  };
  const act = (who, board, action, input = {}) => as(who, (ch, client, h) => actOnContentInstance(ch, board.instance.id,
    { expectedRevision: board.instance.revision, actionId: action.id, ...input }, client, h));
  const quality = (who, board, operation, input = {}) => as(who, (ch, client, h) => actOnContentQuality(ch, board.instance.id,
    { expectedRevision: board.instance.revision, expectedQualityRevision: board.instance.quality.revision, operation, ...input }, client, h));
  const read = (who, board) => as(who, (ch, client, h) => contentInstanceBoard(ch, board.instance.id, client, h));
  const start = async (who, name) => {
    const pack = packs.get(name); assert(pack, `Known case ${name}`);
    const board = await as(who, (ch, client, h) => createContentInstance(ch, pack.namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h));
    return act(who, board, board.instance.actions.find(action => action.kind === 'start_instance'));
  };
  const answer = (board, action) => {
    const pack = packs.get(board.instance.experienceId), node = pack.nodes.find(node => node.id === action.nodeId);
    const payload = narrativeVariant(node, board.instance.id);
    const spec = pack.nodes.find(node => node.id === payload.answerSpecId).payload;
    if (spec.verifier === 'normalized_exact') return { answer: spec.acceptedValues[0] };
    if (spec.verifier === 'mapping') return { submission: { assignments: spec.solution } };
    if (spec.verifier === 'proof_sets') {
      const issued = new Set(action.interaction.items.map(item => item.id));
      const proof = spec.proofs.find(proof => proof.evidenceIds.every(id => issued.has(id)));
      return proof ? { submission: proof } : null;
    }
    return { submission: { ids: spec.solution } };
  };
  const finish = async (who, board, choices = {}) => {
    for (let step = 0; board.instance.status === 'active' && step < 80; step++) {
      const action = board.instance.actions.find(item => item.kind === 'choose' || answer(board, item));
      assert(action, `${board.instance.experienceId} has a satisfiable action`);
      board = await act(who, board, action, action.kind === 'choose'
        ? { choiceId: choices[action.nodeId] || action.options.find(item => item.available).id } : answer(board, action));
    }
    assert.equal(board.instance.status, 'completed'); return board;
  };
  return { pool, packs, as, identity, act, quality, read, start, answer, finish };
}
