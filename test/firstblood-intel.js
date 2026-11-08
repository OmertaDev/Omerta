// The coach-to-roster journey must identify only the owner's exact First Blood rival.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import { startFirstBlood } from '../src/firstblood.js';
import { recordPlayerIntel } from '../src/playerintel.js';
import { spawnResident, retireResident } from '../src/population.js';

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, token, body) => {
  const response = await app.inject({ method, url,
    headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
};
const create = async name => {
  const { token } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name });
  const { character } = await call('GET', '/v1/me', token);
  const ch = (await pool.query('SELECT * FROM characters WHERE id=$1', [character.id])).rows[0];
  return { token, ch };
};
const streets = async player => (await call('GET', '/v1/streets', player.token)).streets;
const rosterEntry = async (player, id) => (await streets(player)).find(row => row.id === id);

try {
  const player = await create('First Score Witness'), outsider = await create('First Score Stranger');
  const resident = await spawnResident(pool, { band: { id: 'corner', lvl: [1, 2], seed: [200, 400], stat: [1, 3] } });
  await pool.query("UPDATE characters SET loc='docks',respect=100 WHERE id=$1", [resident.id]);
  await pool.query("UPDATE characters SET loc='docks',respect=200 WHERE id=$1", [player.ch.id]);
  await startFirstBlood(pool, player.ch.account_id);
  const before = (await pool.query('SELECT count(*)::int AS n FROM player_intel')).rows[0].n;
  const me = (await call('GET', '/v1/me', player.token)).character;
  const rival = await rosterEntry(player, resident.id);
  assert.equal(rival.name, resident.name, 'the assigned name in the coach can be found in its instructed roster');
  assert(me.coach.hint.includes(rival.name));
  assert.equal(rival.nearby, true, 'ordinary nearby presence still makes the encounter reachable');
  assert.equal(rival.loc, null, 'a callout does not grant a location observation');
  assert.equal(rival.level, null, 'a callout does not grant a level observation');
  assert.equal(rival.guardPrice, null);
  assert.deepEqual(rival.fronts, []);
  assert.equal(rival.observedAt, undefined, 'no synthetic sighting timestamp is manufactured');
  assert(!JSON.stringify(rival).includes(player.ch.account_id));
  assert.equal((await rosterEntry(player, outsider.ch.id)).name, null, 'unrelated nearby identities stay anonymous');
  assert.equal((await rosterEntry(outsider, resident.id)).name, null, 'the assignment is private to its owner');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM player_intel')).rows[0].n, before,
    'reading the roster never writes an observation');

  // Dated knowledge is still authoritative when the assignment is projected.
  const observationTime = new Date(Date.now() - 60000);
  const observedResident = (await pool.query('SELECT * FROM characters WHERE id=$1', [resident.id])).rows[0];
  await recordPlayerIntel(pool, player.ch.account_id, { ...observedResident, loc: 'canal' },
    { source: 'encounter', observedAt: observationTime });
  const known = await rosterEntry(player, resident.id);
  assert.equal(known.loc, 'canal', 'assignment does not overwrite an older located observation');
  assert.equal(new Date(known.observedAt).getTime(), observationTime.getTime());
  assert.equal(known.source, 'encounter');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await retireResident(client, resident.id);
    await client.query('COMMIT');
  } finally { client.release(); }
  const retired = (await pool.query('SELECT * FROM characters WHERE id=$1', [resident.id])).rows[0];
  const heirId = crypto.randomUUID();
  await pool.query("INSERT INTO characters (id,account_id,name,season,is_npc,loc,respect) VALUES ($1,$2,$3,1,true,'docks',100)",
    [heirId, retired.account_id, 'Unintroduced Resident Heir']);
  assert.equal((await rosterEntry(player, heirId)).name, null, 'the rival account does not introduce its replacement character');
  const afterDeath = (await call('GET', '/v1/me', player.token)).character;
  assert.notEqual(afterDeath.coach.label, 'Settle your first score', 'retirement clears the stale assignment');

  await startFirstBlood(pool, player.ch.account_id);
  assert.equal((await rosterEntry(player, heirId)).name, 'Unintroduced Resident Heir', 'a fresh exact assignment introduces the new rival');
  assert.equal((await rosterEntry(outsider, heirId)).name, null);

  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [player.ch.id]);
  await pool.query("INSERT INTO characters (id,account_id,name,season,loc) VALUES ($1,$2,$3,1,'docks')",
    [crypto.randomUUID(), player.ch.account_id, 'First Score Successor']);
  assert.equal((await rosterEntry(player, heirId)).name, null, 'the player heir does not inherit the previous character assignment');
  console.log('firstblood intel: coach-to-roster identity, owner isolation, read-only privacy, dated sightings and both character replacements passed');
} finally { await app.close(); }
