import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { circleHighlights } from '../src/circle-highlights.js';

if (process.env.DATABASE_URL) throw new Error('Circle highlights tests require the disposable in-memory database.');
const app = await buildServer();
const pool = app.pool;
const create = async (name) => {
  const auth = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const { token } = auth.json();
  const response = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}` }, payload: { name } });
  assert.equal(response.statusCode, 200);
  return (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0];
};
try {
  const me = await create('Highlight Reader'), mate = await create('Highlight Mate'), stranger = await create('Hidden Stranger');
  const joined = new Date(Date.now() - 3600000), before = new Date(joined.getTime() - 10000), after = new Date(joined.getTime() + 10000);
  await pool.query("INSERT INTO crew_members (crew_id,account_id,name,joined_at) VALUES ('highlights-crew',$1,$2,$3),('highlights-crew',$4,$5,$3)", [me.account_id, me.name, joined, mate.account_id, mate.name]);
  const notification = (id, character, type, payload) => pool.query('INSERT INTO notifications (id,character_id,type,payload) VALUES ($1,$2,$3,$4)', [id, character.id, type, JSON.stringify(payload)]);
  await notification('highlight-own-mastery', me, 'mastery_up', { name: 'Larceny', lvl: 4, rank: 'Apprentice' });
  await notification('highlight-mentor', me, 'protege_graduated', { protege: mate.name });
  await notification('highlight-unrelated-inbox', stranger, 'mastery_up', { name: 'SECRET', lvl: 9 });
  await notification('highlight-nonmilestone', me, 'attack', { from: 'SECRET ATTACK' });
  const message = (id, channel, text, at) => pool.query('INSERT INTO chat_messages (id,channel,character_id,name,body,at) VALUES ($1,$2,$3,$4,$5,$6)', [id, channel, mate.id, mate.name, text, at]);
  await message('highlight-shared-case', 'crew:highlights-crew', '[Milestone] Closed the canal case', after);
  await message('highlight-before-join', 'crew:highlights-crew', '[Milestone] SECRET BACKCHAT', before);
  await message('highlight-other-crew', 'crew:another-crew', '[Milestone] SECRET OTHER CREW', after);
  await message('highlight-unshared-chat', 'crew:highlights-crew', 'SECRET ORDINARY CHAT', after);
  const txBefore = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  const highlights = await circleHighlights(pool, me);
  assert.equal(highlights.length, 3);
  assert.ok(highlights.some((h) => h.kind === 'mastery' && h.text.includes('Apprentice')));
  assert.ok(highlights.some((h) => h.kind === 'mentor' && h.who === mate.name));
  assert.ok(highlights.some((h) => h.kind === 'shared' && h.text === 'Closed the canal case' && h.source === 'crew message'));
  assert.ok(!JSON.stringify(highlights).includes('SECRET'), 'only already-authorized inbox milestones and current crew shares are readable');
  assert.ok(!JSON.stringify(highlights).includes(me.account_id), 'account identifiers never leave the helper');
  await pool.query('UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [me.account_id, 'new-highlights-crew']);
  assert.ok(!(await circleHighlights(pool, me)).some((h) => h.kind === 'shared'), 'leaving a crew removes access to its shared highlights');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), txBefore, 'highlight reads do not move value');
  console.log('circle-highlights: PASS');
} finally { await app.close(); }
