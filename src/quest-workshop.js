// Player-authored mysteries use only fixed fictional roles and server-authored evidence.
// Authors select a solvable deduction puzzle; definitions never execute code or award value.
import crypto from 'node:crypto';
import { GameError } from './game.js';

export const WORKSHOP_SUSPECTS = Object.freeze([
  { id: 'courier', label: 'The Courier' },
  { id: 'tailor', label: 'The Tailor' },
  { id: 'pianist', label: 'The Pianist' },
]);
export const WORKSHOP_SCENES = Object.freeze([
  { id: 'docks', label: 'The Docks' },
  { id: 'canal', label: 'Canal Street' },
  { id: 'foundry', label: 'The Foundry' },
]);
export const WORKSHOP_TEMPLATES = Object.freeze([
  { id: 'missing-ledger', title: 'The Missing Ledger',
    setup: 'A fictional ledger vanished. Each suspect visited exactly one district, and no two visited the same district. The person at the scene took the ledger.',
    question: 'Who took the ledger?' },
  { id: 'switched-envelope', title: 'The Switched Envelope',
    setup: 'A fictional envelope was switched. Each suspect visited exactly one district, and no two visited the same district. The person at the scene switched the envelope.',
    question: 'Who switched the envelope?' },
  { id: 'silent-piano', title: 'The Silent Piano',
    setup: 'Someone hid the keys to a fictional club piano. Each suspect visited exactly one district, and no two visited the same district. The person at the scene hid the keys.',
    question: 'Who hid the keys?' },
]);
export const WORKSHOP_CLUES = Object.freeze(WORKSHOP_SUSPECTS.flatMap((suspect) =>
  WORKSHOP_SCENES.flatMap((scene) => [true, false].map((at) => ({
    id: `${suspect.id}_${at ? 'at' : 'not'}_${scene.id}`,
    text: `${suspect.label} ${at ? 'was' : 'was not'} at ${scene.label}.`,
    suspectId: suspect.id, sceneId: scene.id, at,
  })))));
const fail = (code, message) => { throw new GameError(code, message); };
const safeId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const isOneOf = (items, id) => items.some((item) => item.id === id);
const publicClue = ({ id, text }) => ({ id, text });

function identity(accountId) {
  if (typeof accountId !== 'string' || !accountId || accountId.length > 200) fail('unauthorized', 'A valid account is required.');
  return accountId;
}

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    fail('bad_workshop_request', 'Use the supplied mystery fields.');
  }
}

export function validateWorkshopDraft(input) {
  exactObject(input, ['title', 'templateId', 'sceneId', 'culpritId', 'clueIds']);
  if (typeof input.title !== 'string' || input.title.trim() !== input.title
      || input.title.length < 3 || input.title.length > 80
      || !/^[\p{L}\p{N} .,'!?():-]+$/u.test(input.title)
      || !isOneOf(WORKSHOP_TEMPLATES, input.templateId)
      || !isOneOf(WORKSHOP_SCENES, input.sceneId)
      || !isOneOf(WORKSHOP_SUSPECTS, input.culpritId)
      || !Array.isArray(input.clueIds) || input.clueIds.length < 2 || input.clueIds.length > 6
      || new Set(input.clueIds).size !== input.clueIds.length
      || input.clueIds.some((id) => !isOneOf(WORKSHOP_CLUES, id))) {
    fail('bad_workshop_request', 'Choose a title, template, scene, suspect, and two to six distinct supplied clues.');
  }
  return { ...input, clueIds: [...input.clueIds] };
}

export function workshopSolutions(clueIds) {
  const clues = clueIds.map((id) => WORKSHOP_CLUES.find((clue) => clue.id === id));
  if (clues.some((clue) => !clue)) fail('bad_workshop_request', 'Choose evidence from the supplied list.');
  const solutions = [];
  for (const first of WORKSHOP_SCENES) for (const second of WORKSHOP_SCENES) for (const third of WORKSHOP_SCENES) {
    if (new Set([first.id, second.id, third.id]).size !== 3) continue;
    const assignment = { courier: first.id, tailor: second.id, pianist: third.id };
    if (clues.every((clue) => (assignment[clue.suspectId] === clue.sceneId) === clue.at)) solutions.push(assignment);
  }
  return solutions;
}

export function validateWorkshopSolution(input) {
  const definition = validateWorkshopDraft(input);
  const solutions = workshopSolutions(definition.clueIds);
  if (solutions.length !== 1 || solutions[0][definition.culpritId] !== definition.sceneId) {
    fail('unsolvable_workshop_mystery', 'The evidence must produce exactly one complete arrangement and agree with your chosen culprit.');
  }
  return definition;
}

function definition(row) {
  return { title: row.title, templateId: row.template_id, sceneId: row.scene_id,
    culpritId: row.culprit_id, clueIds: JSON.parse(row.clue_ids) };
}

function summary(row, stats = {}, mine = null) {
  const ratings = Number(stats.ratings || 0);
  return { id: row.id, title: row.title, templateId: row.template_id, sceneId: row.scene_id,
    status: row.status, authorCredit: row.author_credit, createdAt: row.created_at, publishedAt: row.published_at,
    rating: ratings ? Math.round(Number(stats.rating) * 10) / 10 : null,
    ratings, solved: Boolean(mine?.solved_at), myRating: mine?.stars == null ? null : Number(mine.stars) };
}

function ownDraft(row) {
  return { ...summary(row), ...definition(row) };
}

async function readMystery(queryable, accountId, id, { published = false, lock = false } = {}) {
  if (!safeId(id)) fail('bad_workshop_request', 'Choose a valid mystery.');
  const row = (lock
    ? await queryable.query('SELECT * FROM quest_workshop_mysteries WHERE id=$1 FOR UPDATE', [id])
    : await queryable.query('SELECT * FROM quest_workshop_mysteries WHERE id=$1', [id])).rows[0];
  if (!row || (published && row.status !== 'published')
      || (row.status !== 'published' && row.author_account_id !== accountId)) {
    fail('workshop_unavailable', 'That mystery is unavailable.');
  }
  return row;
}

async function publicPuzzle(queryable, row, accountId, projection = null) {
  if (!projection) {
    const stats = await queryable.query('SELECT COUNT(stars) AS ratings, AVG(stars) AS rating FROM quest_workshop_plays WHERE mystery_id=$1', [row.id]);
    const mine = await queryable.query('SELECT solved_at,stars FROM quest_workshop_plays WHERE mystery_id=$1 AND account_id=$2', [row.id, accountId]);
    projection = { stats: stats.rows[0], mine: mine.rows[0] };
  }
  const template = WORKSHOP_TEMPLATES.find((item) => item.id === row.template_id);
  return { ...summary(row, projection.stats, projection.mine), setup: template.setup, question: template.question,
    scene: WORKSHOP_SCENES.find((item) => item.id === row.scene_id), suspects: WORKSHOP_SUSPECTS,
    clues: JSON.parse(row.clue_ids).map((id) => publicClue(WORKSHOP_CLUES.find((clue) => clue.id === id))) };
}

// Lock the real account row to serialize the small per-author creation limit. No game
// character, inventory, ledger, permissions, rewards, or economic state is mutated here.
async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export function createQuestWorkshopService({ pool }) {
  return {
    async board(accountId) {
      identity(accountId);
      const mine = (await pool.query('SELECT * FROM quest_workshop_mysteries WHERE author_account_id=$1 ORDER BY created_at DESC LIMIT 20', [accountId])).rows;
      const published = (await pool.query("SELECT * FROM quest_workshop_mysteries WHERE status='published' ORDER BY published_at DESC LIMIT 50")).rows;
      let puzzles = [];
      if (published.length) {
        const ids = published.map((row) => row.id);
        // The catalog is capped at fifty. Fixed bound slots keep every SQL shape
        // preparable; NULL padding cannot match a mystery's non-null primary key.
        const pageIds = Array.from({ length: 50 }, (_value, index) => ids[index] ?? null);
        const stats = await pool.query('SELECT mystery_id,COUNT(stars) AS ratings,AVG(stars) AS rating FROM quest_workshop_plays WHERE mystery_id IN ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50) GROUP BY mystery_id', pageIds);
        const plays = await pool.query('SELECT mystery_id,solved_at,stars FROM quest_workshop_plays WHERE account_id=$1 AND mystery_id IN ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51)', [accountId, ...pageIds]);
        const statsById = new Map(stats.rows.map((row) => [row.mystery_id, row]));
        const playsById = new Map(plays.rows.map((row) => [row.mystery_id, row]));
        for (const row of published) puzzles.push(await publicPuzzle(pool, row, accountId,
          { stats: statsById.get(row.id), mine: playsById.get(row.id) }));
      }
      return { templates: WORKSHOP_TEMPLATES, suspects: WORKSHOP_SUSPECTS, scenes: WORKSHOP_SCENES,
        clues: WORKSHOP_CLUES.map(publicClue), mine: mine.map(ownDraft), published: puzzles };
    },
    async create(accountId, input) {
      identity(accountId);
      const draft = validateWorkshopDraft(input);
      return transaction(pool, async (client) => {
        const account = (await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [accountId])).rows[0];
        if (!account) fail('unauthorized', 'A valid account is required.');
        const count = Number((await client.query('SELECT COUNT(*) AS n FROM quest_workshop_mysteries WHERE author_account_id=$1', [accountId])).rows[0].n);
        if (count >= 20) fail('workshop_limit', 'Each author may keep up to twenty mysteries.');
        const character = (await client.query('SELECT name FROM characters WHERE account_id=$1 AND alive=true LIMIT 1', [accountId])).rows[0];
        if (!character) fail('no_character', 'Create a character before authoring a mystery.');
        const row = (await client.query(`INSERT INTO quest_workshop_mysteries
          (id,author_account_id,author_credit,title,template_id,scene_id,culprit_id,clue_ids)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [crypto.randomUUID(), accountId, character.name, draft.title, draft.templateId, draft.sceneId, draft.culpritId, JSON.stringify(draft.clueIds)])).rows[0];
        return { mystery: ownDraft(row) };
      });
    },
    async get(accountId, id) {
      identity(accountId);
      const row = await readMystery(pool, accountId, id);
      return { mystery: await publicPuzzle(pool, row, accountId) };
    },
    async publish(accountId, id, input) {
      identity(accountId); exactObject(input, []);
      return transaction(pool, async (client) => {
        const row = await readMystery(client, accountId, id, { lock: true });
        if (row.author_account_id !== accountId) fail('workshop_unavailable', 'That mystery is unavailable.');
        validateWorkshopSolution(definition(row));
        if (row.status === 'draft') {
          const updated = (await client.query("UPDATE quest_workshop_mysteries SET status='published',published_at=now() WHERE id=$1 AND author_account_id=$2 RETURNING *", [id, accountId])).rows[0];
          return { mystery: await publicPuzzle(client, updated, accountId) };
        }
        return { mystery: await publicPuzzle(client, row, accountId) };
      });
    },
    async solve(accountId, id, input) {
      identity(accountId); exactObject(input, ['suspectId']);
      if (!isOneOf(WORKSHOP_SUSPECTS, input.suspectId)) fail('bad_workshop_request', 'Choose one of the fictional suspects.');
      const row = await readMystery(pool, accountId, id, { published: true });
      if (row.author_account_id === accountId) fail('workshop_author', 'Authors cannot solve or rate their own mystery.');
      const correct = row.culprit_id === input.suspectId;
      const solved = correct ? new Date() : null;
      const play = (await pool.query(`INSERT INTO quest_workshop_plays (mystery_id,account_id,attempts,solved_at)
        VALUES ($1,$2,1,$3) ON CONFLICT (mystery_id,account_id) DO UPDATE
        SET attempts=quest_workshop_plays.attempts+1, solved_at=COALESCE(quest_workshop_plays.solved_at,EXCLUDED.solved_at)
        RETURNING solved_at`, [id, accountId, solved])).rows[0];
      return { ok: correct, solved: Boolean(play.solved_at),
        message: correct ? 'Case closed. The evidence supports your deduction.' : 'That deduction does not fit the evidence. Review the witness statements.' };
    },
    async rate(accountId, id, input) {
      identity(accountId); exactObject(input, ['stars']);
      if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) fail('bad_workshop_request', 'Rate this mystery from one to five stars.');
      const row = await readMystery(pool, accountId, id, { published: true });
      if (row.author_account_id === accountId) fail('workshop_author', 'Authors cannot solve or rate their own mystery.');
      const result = await pool.query('UPDATE quest_workshop_plays SET stars=$3 WHERE mystery_id=$1 AND account_id=$2 AND solved_at IS NOT NULL RETURNING stars', [id, accountId, input.stars]);
      if (!result.rowCount) fail('workshop_not_solved', 'Solve the mystery before rating it.');
      const puzzle = await publicPuzzle(pool, row, accountId);
      return { rating: puzzle.rating, ratings: puzzle.ratings, myRating: puzzle.myRating };
    },
  };
}
