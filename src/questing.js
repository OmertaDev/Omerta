// Account-owned narrative presentation and a value-neutral reading-room service.
import crypto from 'node:crypto';
import { GameError } from './game.js';

const flagKey = (quest, key) => `omerta.quest.${quest}.${key}`;
const categories = new Map([
  ['early-obituary', 'Protection'], ['family-dinner', 'Relationships'], ['missing-name', 'Restoration'],
  ['three-witnesses', 'Corroboration'], ['quiet-wedding', 'Discretion'], ['morning-after', 'Restitution'],
  ['inherited-file', 'Legacy'], ['archive-service', 'Casework'], ['sixth-envelope', 'Cooperation'],
  ['rival-accord', 'Diplomacy'],
]);
const dayOf = () => Math.floor(Date.now() / 86400000);
const opened = flags => flags.get(flagKey('archive-service', 'reading-desk')) === 'open';

export function readingRoomExercise(accountId, day = dayOf()) {
  const digest = crypto.createHash('sha256').update(`omerta.reading-room.v1\0${accountId}\0${day}`).digest('hex');
  const variant = parseInt(digest.slice(0, 8), 16) % 3;
  const scenarios = [
    { title: 'The Late Arrival', prompt: 'The signed arrival log records 10:10. A witness, looking at a watch known to be twenty minutes fast, remembers 10:30. Select the records supporting the conclusion that these accounts describe the same arrival.',
      items: [{ id: 'log', label: 'Signed log: arrival at 10:10' }, { id: 'watch', label: 'Watch inspection: twenty minutes fast' }, { id: 'rumor', label: 'Rumor that the visitor was late' }], solution: ['log', 'watch'] },
    { title: 'The Borrowed Coat', prompt: 'A dated cloakroom receipt records a coat exchange. An engraved key identifies the original owner of the coat left behind. Select the two records showing that coat color alone cannot identify the departing guest.',
      items: [{ id: 'exchange', label: 'Dated receipt: coats exchanged before departure' }, { id: 'key', label: 'Engraved key in the coat left behind' }, { id: 'guess', label: 'An assumption that guests keep the same coat' }], solution: ['exchange', 'key'] },
    { title: 'The Vanishing Shift', prompt: 'The payroll has eleven names, but twelve independently signed collection receipts and a dated photograph of twelve workers. Select the corroborating records supporting an omitted worker, rather than a simple arithmetic claim.',
      items: [{ id: 'receipts', label: 'Twelve independently signed wage receipts' }, { id: 'photograph', label: 'Dated photograph of twelve workers' }, { id: 'stain', label: 'A stain on the payroll margin' }], solution: ['receipts', 'photograph'] },
  ];
  const selected = scenarios[variant];
  // Rotate the presentation independently of the solution; seed remains server-derived.
  const shift = parseInt(digest.slice(8, 10), 16) % selected.items.length;
  return { ...selected, items: [...selected.items.slice(shift), ...selected.items.slice(0, shift)],
    id: `reading-${day}-${digest.slice(0, 16)}`, day };
}

const publicExercise = ({ solution: _solution, day: _day, ...exercise }) => exercise;
async function memory(client, accountId) {
  return new Map((await client.query('SELECT flag_key,flag_value FROM content_story_flags WHERE account_id=$1', [accountId])).rows
    .map(row => [row.flag_key, row.flag_value]));
}

export async function questingBoard(ch, client) {
  const flags = await memory(client, ch.account_id);
  const completed = (await client.query(
    `SELECT i.namespace,i.experience_id,i.completed_at FROM content_instances i
       JOIN content_instance_members m ON m.instance_id=i.id
      WHERE m.account_id=$1 AND i.status='completed' ORDER BY i.completed_at`, [ch.account_id],
  )).rows;
  const distinct = [...new Map(completed.map(row => [row.namespace, row])).values()];
  const earnedCategories = [...new Set(distinct.map(row => categories.get(row.experience_id)).filter(Boolean))];
  const protection = flags.get(flagKey('early-obituary', 'protection'));
  const friendship = flags.get(flagKey('family-dinner', 'relationship'));
  const relationships = [];
  if (friendship) relationships.push({ id: 'ada', name: 'Ada Vale', state: friendship === 'friend' ? 'Trusted friend' : 'Respected business contact',
    summary: friendship === 'friend' ? 'Ada will discuss the personal stakes of her next request.' : 'Ada keeps your conversations focused on the case.' });
  if (flags.has(flagKey('missing-name', 'rosa'))) relationships.push({ id: 'rosa', name: 'Rosa', state: 'Restored to the record',
    summary: flags.get(flagKey('missing-name', 'rosa')) === 'letter' ? 'You offered a mediated family letter.' : 'You preserved the privacy of her new address.' });
  const districtScenes = [];
  const reopened = protection === 'public' || flags.has(flagKey('morning-after', 'complete'));
  if (protection) districtScenes.push({ id: 'tomas-shop', districtId: 'neon', scope: 'personal',
    title: reopened ? 'Light in the printshop window' : 'A temporarily shuttered printshop',
    text: protection === 'public' ? 'Tomas has reopened after the office stamp was exposed. Ada is away while the source is protected.' : reopened ? 'After you checked the arrangements with Ada, Tomas approved reopening the printshop.' : 'Ada keeps the shop ready while Tomas waits for a safe reopening.',
    followupNamespace: 'omerta.quest.morning-after' });
  const unlocked = opened(flags);
  const exercise = unlocked ? readingRoomExercise(ch.account_id) : null;
  const progress = exercise ? (await client.query(
    'SELECT attempts,solved_at FROM quest_reading_room WHERE account_id=$1 AND day_ordinal=$2', [ch.account_id, exercise.day],
  )).rows[0] : null;
  return { reputation: { distinctCases: distinct.length, categories: earnedCategories,
      title: distinct.length >= 8 ? 'Keeper of the City\'s Stories' : distinct.length >= 3 ? 'Trusted Caseworker' : distinct.length ? 'A Name in the Casebook' : 'A Blank Casebook' },
    relationships, districtScenes,
    nemesis: protection ? { name: 'Inspector Orsini', response: protection === 'public' ? 'He now challenges copies and demands originals.' : 'His men now watch Ada\'s deliveries.', followupNamespace: 'omerta.quest.missing-name' } : null,
    services: [{ id: 'reading-room', title: 'Archive Casework Reading Desk', unlocked,
      summary: 'One fresh, value-neutral deduction exercise each day. Completed work remains recorded for that day.',
      unlockNamespace: 'omerta.quest.archive-service',
      exercise: exercise ? { ...publicExercise(exercise), attempts: Number(progress?.attempts || 0), solved: !!progress?.solved_at } : null }],
  };
}

export async function submitReadingRoom(ch, input, client) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['exerciseId', 'ids'].includes(key))
    || typeof input.exerciseId !== 'string' || !Array.isArray(input.ids)
    || input.ids.length > 3 || input.ids.some(id => typeof id !== 'string') || new Set(input.ids).size !== input.ids.length) {
    throw new GameError('bad_request', 'Submit only the current exercise id and selected evidence ids.');
  }
  const flags = await memory(client, ch.account_id);
  if (!opened(flags)) throw new GameError('quest_service_locked', 'Earn access to the archive reading desk first.');
  const exercise = readingRoomExercise(ch.account_id);
  if (input.exerciseId !== exercise.id) throw new GameError('stale_exercise', 'The reading desk has a new exercise. Refresh the casework board.');
  const allowed = new Set(exercise.items.map(item => item.id));
  if (input.ids.some(id => !allowed.has(id))) throw new GameError('bad_request', 'Use only the issued evidence.');
  await client.query(`INSERT INTO quest_reading_room (account_id,day_ordinal,exercise_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [ch.account_id, exercise.day, exercise.id]);
  const existing = (await client.query('SELECT * FROM quest_reading_room WHERE account_id=$1 AND day_ordinal=$2 FOR UPDATE', [ch.account_id, exercise.day])).rows[0];
  if (existing.solved_at) return { ok: true, solved: true, alreadySolved: true };
  const matched = JSON.stringify([...input.ids].sort()) === JSON.stringify([...exercise.solution].sort());
  await client.query('UPDATE quest_reading_room SET attempts=attempts+1,solved_at=$3 WHERE account_id=$1 AND day_ordinal=$2', [ch.account_id, exercise.day, matched ? new Date() : null]);
  return { ok: true, solved: matched, message: matched ? 'The independent records support your deduction.' : 'Check which records independently establish the conclusion.' };
}
