import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
assert(fs.existsSync(new URL('../src/task-puzzles.js', import.meta.url)), 'durable task-puzzle service must exist');
const { issueTaskPuzzle, readTaskPuzzle, consumeTaskPuzzle } = await import('../src/task-puzzles.js');
const { generateTaskPuzzle } = await import('../src/task-puzzle-engine.js');
const { makeDb } = await import('../src/db.js');
const { withCharacter, GameError } = await import('../src/game.js');
const pool = await makeDb();
const actor = async name => {
  const account = crypto.randomUUID(), id = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [account, 'guest', account]);
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [account]);
  await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [id, account, name]);
  return { account, id };
};
const as = async (who, fn) => { let value; await withCharacter(pool, who.account, async (ch, c, h) => { value = await fn(ch, c, h); return {}; }); return value; };
const context = { scope: 'mission', targetId: 'family-courier', contextKey: '2026-11-10' };
const row = async id => (await pool.query('SELECT * FROM task_puzzles WHERE id=$1', [id])).rows[0];
const refusal = code => error => error instanceof GameError && error.code === code;
try {
  const owner = await actor('Puzzle Owner'), stranger = await actor('Puzzle Stranger');
  assert.equal(await as(owner, (ch, c) => readTaskPuzzle(ch, context, c)), null);
  const first = await as(owner, (ch, c) => issueTaskPuzzle(ch, context, c));
  assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first.status, 'issued');
  assert.doesNotMatch(JSON.stringify(first), /"(?:answer|seed|structuralSignature|character_id|context_key)"\s*:/);
  assert.deepEqual(await as(owner, (ch, c) => issueTaskPuzzle(ch, context, c)), first, 'refresh does not reroll');
  assert.deepEqual(await as(owner, (ch, c) => readTaskPuzzle(ch, context, c)), first, 'read resumes exact persisted constraints');
  assert.equal(await as(stranger, (ch, c) => readTaskPuzzle(ch, context, c)), null, 'issuance is character-bound');
  const stored = await row(first.id), answer = stored.puzzle.answer;
  for (const other of [{ ...context, scope: 'hustle' }, { ...context, targetId: 'another-job' }, { ...context, contextKey: 'tomorrow' }])
    await assert.rejects(as(owner, (ch, c) => consumeTaskPuzzle(ch, other, { id: first.id, answer }, c)), refusal('stale_task_puzzle'));
  await assert.rejects(as(stranger, (ch, c) => consumeTaskPuzzle(ch, context, { id: first.id, answer }, c)), refusal('stale_task_puzzle'));
  await assert.rejects(as(owner, (ch, c) => consumeTaskPuzzle(ch, context, undefined, c)), refusal('task_puzzle_required'));
  for (const submission of [null, {}, { id: first.id, answer, completed: true }, { id: 'garbage', answer }, { id: first.id, answer: {} }])
    await assert.rejects(as(owner, (ch, c) => consumeTaskPuzzle(ch, context, submission, c)), refusal('bad_task_puzzle_answer'));
  assert.equal((await row(first.id)).consumed_at, null, 'refused submissions never consume issuance');
  const done = await as(owner, (ch, c) => consumeTaskPuzzle(ch, context, { id: first.id, answer }, c));
  assert.deepEqual(done, { id: first.id, version: 1, kind: first.kind, completed: true, message: 'Puzzle complete. The task can continue.' });
  await assert.rejects(as(owner, (ch, c) => consumeTaskPuzzle(ch, context, { id: first.id, answer }, c)), refusal('task_puzzle_consumed'));
  const consumed = await as(owner, (ch, c) => issueTaskPuzzle(ch, context, c));
  assert.deepEqual(consumed, { ...first, status: 'consumed' }, 'consumed receipts remain, never reroll the same occurrence');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM task_puzzles WHERE character_id=$1 AND scope=$2 AND target_id=$3 AND context_key=$4', [owner.id, context.scope, context.targetId, context.contextKey])).rows[0].n), 1);
  const recent = [];
  for (let i = 0; i < 24; i++) {
    const issued = await as(owner, (ch, c) => issueTaskPuzzle(ch, { ...context, contextKey: `history-${i}` }, c));
    assert(!recent.slice(-3).some(p => p.kind === issued.kind), 'the previous three mechanics are avoided');
    const signature = (await row(issued.id)).structural_signature;
    assert(!recent.slice(-16).some(p => p.signature === signature), 'recent structural patterns are avoided');
    recent.push({ kind: issued.kind, signature });
  }
  // Force the first candidate to be a genuinely recent pattern, then verify
  // generation retries instead of merely relying on random collisions being rare.
  const seeded = await actor('Pattern Avoidance'), nextId = 'c1111111-1111-4111-8111-111111111111';
  const entropy = Buffer.alloc(32, 17);
  const repeated = generateTaskPuzzle({ seed: `${entropy.toString('hex')}:0`, kind: 'patrol' });
  for (const [index, kind] of ['patrol', 'route', 'matching', 'evidence'].entries()) {
    const puzzle = index ? generateTaskPuzzle({ seed: `fixture-${kind}`, kind }) : repeated;
    await pool.query('INSERT INTO task_puzzles (id,character_id,scope,target_id,context_key,version,kind,structural_signature,puzzle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [crypto.randomUUID(), seeded.id, 'mission', 'history', `seed-${index}`, 1, kind, puzzle.structuralSignature, JSON.stringify(puzzle)]);
  }
  const recovered = await as(seeded, async (ch, c) => {
    const original = crypto.randomUUID, originalBytes = crypto.randomBytes;
    crypto.randomUUID = () => nextId;
    crypto.randomBytes = size => { assert.equal(size, 32); return entropy; };
    try { return await issueTaskPuzzle(ch, context, c); } finally { crypto.randomUUID = original; crypto.randomBytes = originalBytes; }
  });
  assert.equal(recovered.id, nextId); assert.equal(recovered.kind, 'patrol');
  assert.deepEqual(recovered.constraints, generateTaskPuzzle({ seed: `${entropy.toString('hex')}:1`, kind: 'patrol' }).constraints, 'generation uses private entropy independent of the public issuance ID');
  assert.notEqual((await row(recovered.id)).structural_signature, repeated.structuralSignature, 'repeat candidate is actively rejected');
  const unknownContext = { ...context, contextKey: 'future-version' };
  const unknown = await as(owner, (ch, c) => issueTaskPuzzle(ch, unknownContext, c));
  await pool.query('UPDATE task_puzzles SET version=99 WHERE id=$1', [unknown.id]);
  for (const fn of [readTaskPuzzle, issueTaskPuzzle])
    await assert.rejects(as(owner, (ch, c) => fn(ch, unknownContext, c)), refusal('unsupported_task_puzzle'));
  await assert.rejects(as(owner, (ch, c) => consumeTaskPuzzle(ch, unknownContext, { id: unknown.id, answer: (stored.puzzle.answer) }, c)), refusal('unsupported_task_puzzle'));
  assert.equal((await row(unknown.id)).version, 99, 'unsupported issuance is retained for recovery rather than replaced');
  for (const bad of [{ ...context, characterId: stranger.id }, { ...context, contextKey: '' }, { ...context, scope: '../mission' }, null])
    await assert.rejects(as(owner, (ch, c) => issueTaskPuzzle(ch, bad, c)), refusal('task_puzzle_context'));
  console.log('Task-puzzle service PASS: durable refresh, real stored constraints, bounded recent avoidance, exact owner/context binding, consume-once and fail-closed versions.');
} finally { await pool.end(); }
