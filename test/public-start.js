import assert from 'node:assert/strict';
import { resetStartingLevels, registerPgMemCompatibility } from '../src/db.js';
import { readFileSync } from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { inviteModeEnabled } from '../src/invites.js';
import { createGuestAccount } from '../src/auth.js';
import { levelOf } from '../src/rules.js';

delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.INVITE_MODE = 'on'; // Stale deployment settings cannot close admission.
assert.equal(inviteModeEnabled(), false);
const mem = newDb({ noAstCoverageCheck: true });
registerPgMemCompatibility(mem, DataType);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
await pool.query(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
try {
  const accountId = await createGuestAccount(pool, '127.0.0.1');
  assert.ok(accountId, 'signup succeeds without an invitation');
  for (const [id, alive, npc] of [['player', true, false], ['dead', false, false], ['npc', true, true], ['dead-npc', false, true]]) {
    await pool.query('INSERT INTO characters (id,account_id,name,season,respect,alive,is_npc) VALUES ($1,$2,$1,1,10000,$3,$4)', [id, accountId, alive, npc]);
  }
  await pool.query('CREATE TABLE player_reset_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  await pool.query("INSERT INTO player_reset_migrations (id,applied_at) VALUES ('starting-levels-2026-10-06','2026-10-06T00:00:00Z')");
  const oldMarker = (await pool.query('SELECT * FROM player_reset_migrations')).rows[0];
  const before = (await pool.query('SELECT * FROM characters ORDER BY id')).rows;
  await resetStartingLevels(pool);
  const rows = (await pool.query('SELECT * FROM characters ORDER BY id')).rows;
  assert.equal(levelOf(Number(rows.find(r => r.id === 'player').respect)), 1);
  assert.equal(Number(rows.find(r => r.id === 'player').respect), 0, 'the new reset runs even with the October 6 marker');
  for (const row of rows) {
    const original = before.find(value => value.id === row.id);
    assert.deepEqual(row.id === 'player' ? { ...row, respect: original.respect } : row, original,
      'cash, other fields, dead humans and every NPC remain unchanged');
  }
  const markers = (await pool.query('SELECT * FROM player_reset_migrations ORDER BY id')).rows;
  assert.equal(markers.length, 2);
  assert.deepEqual(markers[0], oldMarker, 'the historical marker is preserved');
  assert.equal(markers[1].id, 'starting-levels-2026-10-14');
  await pool.query("UPDATE characters SET respect=1000 WHERE id='player'");
  await resetStartingLevels(pool);
  assert.equal(Number((await pool.query("SELECT respect FROM characters WHERE id='player'")).rows[0].respect), 1000, 'restarts preserve new progress');
  assert.deepEqual((await pool.query('SELECT * FROM player_reset_migrations ORDER BY id')).rows, markers,
    'restarts do not rewrite either reset marker');
  console.log('✅ Public signup; October 14 respect reset upgrades the October 6 marker, preserves cash/dead/NPC state and replays safely');
} finally {
  await pool.end();
}
