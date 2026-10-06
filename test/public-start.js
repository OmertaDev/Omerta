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
  for (const [id, alive, npc] of [['player', true, false], ['dead', false, false], ['npc', true, true]]) {
    await pool.query('INSERT INTO characters (id,account_id,name,season,respect,alive,is_npc) VALUES ($1,$2,$1,1,10000,$3,$4)', [id, accountId, alive, npc]);
  }
  await resetStartingLevels(pool);
  const rows = (await pool.query('SELECT id,respect,cash FROM characters ORDER BY id')).rows;
  assert.equal(levelOf(Number(rows.find(r => r.id === 'player').respect)), 1);
  assert.equal(Number(rows.find(r => r.id === 'player').cash), 500);
  for (const id of ['dead', 'npc']) assert.equal(Number(rows.find(r => r.id === id).respect), 10000);
  await pool.query("UPDATE characters SET respect=1000 WHERE id='player'");
  await resetStartingLevels(pool);
  assert.equal(Number((await pool.query("SELECT respect FROM characters WHERE id='player'")).rows[0].respect), 1000, 'restarts preserve new progress');
  console.log('✅ Public signup and one-time starting level reset');
} finally {
  await pool.end();
}
