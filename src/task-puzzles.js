// Caller contract: issue and consume run on the SAME transaction client and
// under the SAME existing character lock as the authoritative job. This module
// never opens/commits a transaction, changes eligibility, or awards anything.
// Contexts must be derived by trusted server adapters, never taken from a body.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { generateTaskPuzzle, publicTaskPuzzle, verifyTaskPuzzle, TASK_PUZZLE_KINDS, TASK_PUZZLE_VERSION } from './task-puzzle-engine.js';

const HISTORY_LIMIT = 16, GENERATION_ATTEMPTS = 32;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value, limit) => typeof value === 'string' && new RegExp(`^[!-~]{1,${limit}}$`).test(value);
const fail = (code, message) => { throw new GameError(code, message); };
function contextOf(ch, context, client) {
  if (!client || typeof client.query !== 'function') throw new TypeError('Task puzzles require the caller transaction client');
  if (!text(ch?.id, 128) || !exact(context, ['scope', 'targetId', 'contextKey']) ||
    typeof context.scope !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(context.scope) ||
    !text(context.targetId, 128) || !text(context.contextKey, 256))
    fail('task_puzzle_context', 'The task context is invalid. Reopen the task to recover.');
  return [ch.id, context.scope, context.targetId, context.contextKey];
}
async function findIssued(client, binding) {
  return (await client.query('SELECT * FROM task_puzzles WHERE character_id=$1 AND scope=$2 AND target_id=$3 AND context_key=$4', binding)).rows[0];
}
function supported(row) {
  if (row.version !== TASK_PUZZLE_VERSION || row.puzzle?.version !== row.version || row.puzzle?.kind !== row.kind || !TASK_PUZZLE_KINDS.includes(row.kind))
    fail('unsupported_task_puzzle', 'This issued puzzle version is unavailable. Keep this task and try again after the service is updated.');
}
function publicIssued(row) {
  supported(row);
  return { id: row.id, ...publicTaskPuzzle(row.puzzle), status: row.consumed_at ? 'consumed' : 'issued' };
}
export async function readTaskPuzzle(ch, context, client) {
  const row = await findIssued(client, contextOf(ch, context, client));
  return row ? publicIssued(row) : null;
}
export async function issueTaskPuzzle(ch, context, client) {
  const binding = contextOf(ch, context, client), existing = await findIssued(client, binding);
  if (existing) return publicIssued(existing);
  // The bounded lookup retains old consumed receipts while limiting selection work.
  const recent = (await client.query('SELECT kind,structural_signature FROM task_puzzles WHERE character_id=$1 ORDER BY issue_order DESC LIMIT 16', [ch.id])).rows;
  const avoidedKinds = new Set(recent.slice(0, 3).map(row => row.kind));
  const kinds = TASK_PUZZLE_KINDS.filter(kind => !avoidedKinds.has(kind));
  // Seed is independent of the public issuance ID and is never retained or returned.
  const id = crypto.randomUUID(), seed = crypto.randomBytes(32).toString('hex');
  const kind = kinds[parseInt(crypto.createHash('sha256').update(id).digest('hex').slice(0, 8), 16) % kinds.length];
  const signatures = new Set(recent.slice(0, HISTORY_LIMIT).map(row => row.structural_signature));
  let puzzle;
  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const candidate = generateTaskPuzzle({ seed: `${seed}:${attempt}`, kind });
    if (!signatures.has(candidate.structuralSignature)) { puzzle = candidate; break; }
  }
  if (!puzzle) fail('task_puzzle_unavailable', 'A fresh puzzle could not be prepared. Reopen the task and try again.');
  await client.query('INSERT INTO task_puzzles (id,character_id,scope,target_id,context_key,version,kind,structural_signature,puzzle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, ...binding, puzzle.version, kind, puzzle.structuralSignature, JSON.stringify(puzzle)]);
  return { id, ...publicTaskPuzzle(puzzle), status: 'issued' };
}
export async function consumeTaskPuzzle(ch, context, submission, client) {
  const binding = contextOf(ch, context, client);
  if (submission === undefined) fail('task_puzzle_required', 'Complete the task puzzle before continuing.');
  if (!exact(submission, ['id', 'answer']) || !uuid(submission.id))
    fail('bad_task_puzzle_answer', 'Submit the issued puzzle ID and its answer only.');
  const row = await findIssued(client, binding);
  if (!row || row.id !== submission.id) fail('stale_task_puzzle', 'This answer belongs to another task or occurrence. Reopen the current task.');
  supported(row);
  if (row.consumed_at) fail('task_puzzle_consumed', 'This puzzle was already used for its task. Refresh the task to see the result.');
  if (!verifyTaskPuzzle(row.puzzle, submission.answer)) fail('bad_task_puzzle_answer', 'That answer does not satisfy the puzzle. Review the constraints or use the hint.');
  const consumed = await client.query('UPDATE task_puzzles SET consumed_at=now() WHERE id=$1 AND character_id=$2 AND scope=$3 AND target_id=$4 AND context_key=$5 AND consumed_at IS NULL RETURNING id',
    [row.id, ...binding]);
  if (consumed.rowCount !== 1) fail('task_puzzle_consumed', 'This puzzle was already used for its task. Refresh the task to see the result.');
  return { id: row.id, version: row.version, kind: row.kind, completed: true, message: 'Puzzle complete. The task can continue.' };
}
