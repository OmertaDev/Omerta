import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { sendDailyCashReminders, DAILY_CASH_MESSAGE } from '../src/dailyreminder.js';
import { bus } from '../src/game.js';

delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
const pool = await makeDb();
const now = Date.UTC(2026, 9, 6, 12);
let events = 0;
bus.on('me:player', () => events++);
try {
  for (const [id, status, alive, npc] of [
    ['player', 'active', true, false], ['agent', 'active', true, false],
    ['dead', 'active', false, false], ['npc', 'active', true, true], ['banned', 'banned', true, false],
  ]) {
    await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject,status) VALUES ($1,\'guest\',$1,$2)', [id, status]);
    await pool.query('INSERT INTO characters (id,account_id,name,season,alive,is_npc) VALUES ($1,$1,$1,1,$2,$3)', [id, alive, npc]);
  }
  assert.equal((await sendDailyCashReminders(pool, now)).sent, 2);
  assert.equal(events, 1);
  let notes = (await pool.query('SELECT * FROM notifications')).rows;
  assert(notes.every(n => !n.delivered));
  assert.equal(JSON.parse(notes[0].payload).message, DAILY_CASH_MESSAGE);
  await pool.query('UPDATE notifications SET delivered=true');
  const repeats = await Promise.all([sendDailyCashReminders(pool, now), sendDailyCashReminders(pool, now)]);
  assert(repeats.every(r => r.sent === 0), 'reading and overlapping sweeps do not duplicate reminders');
  await pool.query("UPDATE characters SET alive=false WHERE id='player'");
  await pool.query("INSERT INTO characters (id,account_id,name,season) VALUES ('heir','player','heir',1)");
  assert.equal((await sendDailyCashReminders(pool, now)).sent, 0, 'replacement does not reset the daily allowance');
  assert.equal((await sendDailyCashReminders(pool, now + 86400000)).sent, 2);
  notes = (await pool.query('SELECT * FROM notifications')).rows;
  assert.equal(notes.length, 4);
  assert(notes.some(n => n.character_id === 'heir'));
  console.log('✅ Daily inbox reminders: eligible players, unread message, daily rollover, retry/concurrency and heir deduplication');
} finally {
  bus.removeAllListeners('me:player');
  await pool.end();
}
