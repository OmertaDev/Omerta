// Trusted adapters: callers supply only a public task selector, never occurrence keys.
import { GameError } from './game.js';
import { CRIMES, dayOf } from './rules.js';
import { issueTaskPuzzle, readTaskPuzzle } from './task-puzzles.js';

export const REQUIRED_PUZZLE_MISSIONS = Object.freeze(['m2', 'm11', 'm12']);
export const missionPuzzle = id => REQUIRED_PUZZLE_MISSIONS.includes(id)
  ? { required: true, scope: 'mission', targetId: id } : null;
export const hustlePuzzle = () => ({ required: true, scope: 'hustle', targetId: 'legwork', step: 1 });
export const crimePuzzle = id => ({ required: false, scope: 'crime', targetId: id, benefit: 'feedback_only' });
const invalid = () => { throw new GameError('task_puzzle_context', 'The task context is invalid. Reopen the task to recover.'); };

export async function taskPuzzleContext(ch, selector, client) {
  if (!selector || typeof selector !== 'object' || Array.isArray(selector) ||
    Object.keys(selector).sort().join(',') !== 'scope,targetId') invalid();
  const { scope, targetId } = selector;
  if (scope === 'mission' && REQUIRED_PUZZLE_MISSIONS.includes(targetId))
    return { scope, targetId, contextKey: 'once' };
  if (scope === 'hustle' && targetId === 'legwork') {
    const day = dayOf();
    const row = (await client.query('SELECT step FROM hustles WHERE character_id=$1 AND day=$2', [ch.id, day])).rows[0];
    if (!row || Number(row.step) < 1) throw new GameError('hustle_step', 'Meet the Hustle contact before opening the legwork puzzle.');
    return { scope, targetId, contextKey: `day:${day}:step:1` };
  }
  if (scope === 'crime' && CRIMES.some(crime => crime.id === targetId)) {
    // This direct-SQL revision is not in persistCharacter's positional update.
    // Every committed attempt advances it, even failures, without drawing RNG.
    const row = (await client.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0];
    if (!row) invalid();
    return { scope, targetId, contextKey: `attempt:${row.crime_puzzle_revision}` };
  }
  invalid();
}

export async function jobTaskPuzzle(ch, selector, client, issue = false) {
  const context = await taskPuzzleContext(ch, selector, client);
  return { puzzle: await (issue ? issueTaskPuzzle : readTaskPuzzle)(ch, context, client) };
}
