import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { opsActivity } from '../src/ops.js';
import { opsEngagement } from '../src/engagement.js';

const db = newDb();
const { Pool } = db.adapters.createPg();
const pool = new Pool();
const ddl = fs.readFileSync('schema.sql', 'utf8').match(/CREATE TABLE IF NOT EXISTS telemetry \([\s\S]*?\n\);/)[0];
await pool.query(`CREATE TABLE accounts (id TEXT PRIMARY KEY, status TEXT, created_at TIMESTAMPTZ);
  CREATE TABLE account_persistent (account_id TEXT PRIMARY KEY, agent_flag BOOLEAN, npc_flag BOOLEAN);`);
await pool.query(ddl);
const born = new Date(Date.now() - 12 * 86400000);
const at = new Date(Date.now() - 1000);
const game = ['game-event', 'player', 'crime_attempt', '{"kind":"pick"}', at];
try {
  await pool.query('INSERT INTO accounts (id,status,created_at) VALUES ($1,$2,$3)', ['player', 'active', born]);
  await pool.query('INSERT INTO account_persistent (account_id,agent_flag,npc_flag) VALUES ($1,false,false)', ['player']);
  const insert = 'INSERT INTO telemetry (id,account_id,event,props,at) VALUES ($1,$2,$3,$4,$5)';
  await pool.query(insert, game);
  const activity = await opsActivity(pool, 1);
  const engagement = await opsEngagement(pool, 14);
  assert.equal(activity.events.length, 1);
  assert.equal(engagement.players.activeInWindow, 1);
  assert.equal(engagement.systems.reduce((n, system) => n + system.events, 0), 1);

  await pool.query(insert, ['website_count:fixture', null, 'website_count', '9000', new Date()]);
  assert.deepEqual(await opsActivity(pool, 1), activity,
    'daily website counts cannot displace the newest gameplay event in the bounded activity feed');
  assert.deepEqual(await opsEngagement(pool, 14), engagement,
    'website aggregates change no adoption, activity, retention, funnel or uncatalogued-event metric');

  // Put the aggregate first in the fixture's scan order, then shrink the real reader's sample.
  // Filtering after LIMIT would consume its only slot and lose the earned gameplay event.
  await pool.query("DELETE FROM telemetry WHERE id='game-event'");
  await pool.query(insert, game);
  const bounded = { query: (sql, values) => pool.query(sql,
    sql.includes('SELECT account_id, event, props, at FROM telemetry') ? [values[0], 1] : values) };
  assert.deepEqual(await opsEngagement(bounded, 14), engagement,
    'website counts are excluded before the gameplay sample limit');
  assert.equal((await pool.query("SELECT COUNT(DISTINCT account_id) AS n FROM telemetry")).rows[0].n, 1,
    'account-less website counts do not create online players');
  console.log('site-analytics-isolation: PASS — aggregate counts preserve live activity, bounded engagement, retention and player counts');
} finally {
  await pool.end();
}
