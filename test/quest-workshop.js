import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { makeDb } from '../src/db.js';
import { ensureQuestWorkshop } from '../src/quest-workshop-schema.js';
import { createQuestWorkshopService, validateWorkshopSolution, workshopSolutions } from '../src/quest-workshop.js';
import { register } from '../src/routes/quest-workshop.js';

const valid = { title: 'The Ledger at Midnight', templateId: 'missing-ledger', sceneId: 'docks',
  culpritId: 'courier', clueIds: ['courier_at_docks', 'tailor_at_canal'] };
assert.equal(workshopSolutions(valid.clueIds).length, 1);
assert.deepEqual(validateWorkshopSolution(valid), valid);
for (const input of [
  { ...valid, clueIds: ['courier_not_canal', 'tailor_not_docks'] },
  { ...valid, clueIds: ['courier_at_docks', 'tailor_at_docks'] },
  { ...valid, culpritId: 'pianist' },
]) assert.throws(() => validateWorkshopSolution(input), (error) => error.code === 'unsolvable_workshop_mystery');
for (const input of [
  { ...valid, title: '<img src=x onerror=alert(1)>' },
  { ...valid, author_account_id: 'someone-else' },
  { ...valid, rewards: { cash: 999999 } },
  { ...valid, clueIds: ['courier_at_docks', 'courier_at_docks'] },
  { ...valid, clueIds: ['courier_at_docks', "SELECT * FROM accounts"] },
]) assert.throws(() => validateWorkshopSolution(input), (error) => error.code === 'bad_workshop_request');

const pool = await makeDb();
await ensureQuestWorkshop(pool);
await ensureQuestWorkshop(pool);
const service = createQuestWorkshopService({ pool });
const app = Fastify();
const auth = async (req, reply) => {
  const account = req.headers.authorization?.replace(/^Bearer /, '');
  if (!['author', 'reader', 'third'].includes(account)) return reply.code(401).send({ error: 'unauthorized' });
  req.user = { sub: account };
};
register(app, { pool, auth });
const request = (method, path, account, body) => app.inject({ method, url: `/v1/quest-workshop${path}`,
  headers: account ? { authorization: `Bearer ${account}` } : {}, ...(body === undefined ? {} : { payload: body }) });
const noSecrets = (value) => {
  assert.doesNotMatch(JSON.stringify(value), /culpritId|culprit_id|author_account_id|clue_ids|solved_at/);
};

try {
  for (const id of ['author', 'reader', 'third']) {
    await pool.query("INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,'test',$1)", [id]);
    await pool.query('INSERT INTO characters (id,account_id,name,season,cash) VALUES ($1,$2,$3,1,500)', [`character-${id}`, id, `${id} name`]);
  }
  assert.equal((await request('GET', '')).statusCode, 401);
  assert.equal((await request('POST', '', 'author', { ...valid, accountId: 'third' })).statusCode, 400);
  const created = await request('POST', '', 'author', valid);
  assert.equal(created.statusCode, 200, created.body);
  const draft = created.json().mystery;
  assert.equal(draft.authorCredit, 'author name');
  assert.equal(draft.culpritId, 'courier', 'only the authenticated author board/create exposes authoring state');
  assert.equal((await request('GET', `/${draft.id}`, 'reader')).statusCode, 404);
  assert.equal((await request('POST', `/${draft.id}/publish`, 'reader', {})).statusCode, 404);
  assert.equal((await request('POST', `/${draft.id}/solve`, 'reader', { suspectId: 'courier' })).statusCode, 404);
  const badDraft = (await request('POST', '', 'author', { ...valid,
    clueIds: ['courier_not_canal', 'tailor_not_docks'] })).json().mystery;
  const unsolvable = await request('POST', `/${badDraft.id}/publish`, 'author', {});
  assert.equal(unsolvable.statusCode, 400);
  assert.equal(unsolvable.json().error, 'unsolvable_workshop_mystery');
  const published = await request('POST', `/${draft.id}/publish`, 'author', {});
  assert.equal(published.statusCode, 200, published.body);
  assert.equal(published.json().mystery.status, 'published');
  noSecrets(published.json());
  const again = await request('POST', `/${draft.id}/publish`, 'author', {});
  assert.equal(again.json().mystery.publishedAt, published.json().mystery.publishedAt, 'publication retry does not move its timestamp');
  const publicRead = await request('GET', `/${draft.id}`, 'reader');
  assert.equal(publicRead.statusCode, 200);
  noSecrets(publicRead.json());
  assert.equal(publicRead.json().mystery.clues.length, 2);
  const board = (await request('GET', '', 'reader')).json();
  assert.equal(board.mine.length, 0);
  assert.equal(board.published.length, 1);
  noSecrets(board);
  assert.equal((await request('POST', `/${draft.id}/publish`, 'reader', {})).statusCode, 404, 'published ownership remains enforced');
  assert.equal((await request('POST', `/${draft.id}/rate`, 'reader', { stars: 5 })).json().error, 'workshop_not_solved');
  assert.equal((await request('POST', `/${draft.id}/solve`, 'author', { suspectId: 'courier' })).json().error, 'workshop_author');
  assert.equal((await request('POST', `/${draft.id}/rate`, 'author', { stars: 5 })).json().error, 'workshop_author');
  assert.equal((await request('POST', `/${draft.id}/solve`, 'reader', { suspectId: 'pianist' })).json().solved, false);
  const solved = await request('POST', `/${draft.id}/solve`, 'reader', { suspectId: 'courier' });
  assert.equal(solved.json().solved, true, solved.body);
  noSecrets(solved.json());
  assert.equal((await request('POST', `/${draft.id}/solve`, 'reader', { suspectId: 'tailor' })).json().solved, true, 'an incorrect replay cannot erase completion');
  assert.equal((await request('POST', `/${draft.id}/rate`, 'reader', { stars: '5' })).statusCode, 400, 'strict numeric ratings');
  assert.equal((await request('POST', `/${draft.id}/rate`, 'reader', { stars: 0 })).statusCode, 400);
  assert.equal((await request('POST', `/${draft.id}/rate`, 'reader', { stars: 6 })).statusCode, 400);
  const rated = (await request('POST', `/${draft.id}/rate`, 'reader', { stars: 4 })).json();
  assert.deepEqual(rated, { rating: 4, ratings: 1, myRating: 4 });
  const rerated = (await request('POST', `/${draft.id}/rate`, 'reader', { stars: 5 })).json();
  assert.deepEqual(rerated, { rating: 5, ratings: 1, myRating: 5 }, 'rating updates never create extra votes');
  await request('POST', `/${draft.id}/solve`, 'third', { suspectId: 'courier' });
  assert.deepEqual((await request('POST', `/${draft.id}/rate`, 'third', { stars: 3 })).json(),
    { rating: 4, ratings: 2, myRating: 3 });
  const restarted = createQuestWorkshopService({ pool });
  const persisted = (await restarted.get('reader', draft.id)).mystery;
  assert.equal(persisted.solved, true);
  assert.equal(persisted.myRating, 5);
  noSecrets(persisted);
  const stored = (await pool.query('SELECT * FROM quest_workshop_plays WHERE mystery_id=$1 AND account_id=$2', [draft.id, 'reader'])).rows[0];
  assert.equal(Number(stored.attempts), 3);
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE account_id='reader'")).rows[0].cash), 500, 'authoring/solving/ratings cannot mint cash');
  for (let index = 2; index < 20; index++) await service.create('author', { ...valid, title: `Case ${index}` });
  await assert.rejects(service.create('author', valid), (error) => error.code === 'workshop_limit');
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM quest_workshop_mysteries WHERE author_account_id='author'")).rows[0].n), 20);
  const failing = Fastify();
  register(failing, { auth, service: { board: () => { throw new Error('private SQL and culprit_id'); } } });
  const failure = await failing.inject({ method: 'GET', url: '/v1/quest-workshop', headers: { authorization: 'Bearer reader' } });
  assert.equal(failure.statusCode, 500);
  assert.doesNotMatch(failure.body, /SQL|culprit/);
  await failing.close();
  console.log('quest workshop: solvability, strict inputs, auth, ownership, hidden solutions, persistence, ratings, author cap and value-neutrality passed');
} finally {
  await app.close();
  await pool.end();
}
