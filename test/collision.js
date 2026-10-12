// THE COLLISION (src/collision.js) — make a real human being around VISIBLE, the thing the NPC scenery
// hides in a thin population. HERE/NEARBY/district counts derive from learned observations,
// without live presence or automatic stranger discovery. REAL humans only —
// residents + agents excluded. §10.4-FREE (pure reads, no ledger row). Runs on pg-mem — zero infra.
import assert from 'node:assert';
import { buildServer } from '../src/server.js';
import { spawnResident } from '../src/population.js';
import { collisionBoard } from '../src/collision.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { DISCOVERY } from '../src/rules.js';
import { recordPlayerIntel } from '../src/playerintel.js';

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body } = {}) => {
  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  return { code: res.statusCode, body: res.json() };
};
const meOf = async (token) => (await call('GET', '/v1/me', { token })).body.character;
const seedCh = (id, cols) => pool.query(`UPDATE characters SET ${cols} WHERE id='${id}'`);
const acctOf = async (id) => (await pool.query('SELECT account_id a FROM characters WHERE id=$1', [id])).rows[0].a;
const mk = async (name) => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', { token, body: { name } });
  const id = (await meOf(token)).id;
  return { token, id, acct: await acctOf(id) };
};
const chRow = async (id) => (await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0];
const learn = async (target) => recordPlayerIntel(pool, me.acct, await chRow(target.id));

// ── the viewer, at the docks, mid-level ──
const me = await mk('The Viewer');
await seedCh(me.id, "respect=200, loc='docks'");

// ── real humans: one in the viewer's district (HERE), one near-level elsewhere (NEARBY) ──
const here1 = await mk('Docks Human');
await seedCh(here1.id, "respect=180, loc='docks'");
const near1 = await mk('Canal Human');
await seedCh(near1.id, "respect=220, loc='canal'");
// a far, off-level human to populate a HOT district but not NEARBY
const far1 = await mk('Neon Whale');
await seedCh(far1.id, "respect=500000, loc='neon'");

// ── scenery that must be EXCLUDED: an NPC resident in the viewer's district, and an agent ──
const res = await spawnResident(pool, { band: { id: 'corner', lvl: [1, 2], seed: [200, 400], stat: [1, 3] } });
await seedCh(res.id, "loc='docks', respect=190");
const agent = await mk('Agent Smith');
await seedCh(agent.id, "respect=200, loc='docks'");
await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [agent.acct]);

const client = await pool.connect();
try {
  const meCh = await chRow(me.id);

  // ── nobody online: the lists still surface real humans (online is a FLAG, not a filter), all offline ──
  let b = await collisionBoard(client, meCh, []);
  assert.deepEqual(b.here, [], 'unmet local players have no identity');
  assert.deepEqual(b.nearby, [], 'remote players are not automatically discovered');
  assert.deepEqual(b.hotDistricts, [], 'unknown players cannot create a global location radar');
  for (const target of [here1, near1, far1, res, agent]) await learn(target);
  b = await collisionBoard(client, meCh, []);
  assert.ok(b.here.some((p) => p.id === here1.id), 'the district human is HERE');
  assert.ok(!b.here.some((p) => p.id === res.id), 'the NPC resident is EXCLUDED from HERE (scenery, not a real player)');
  assert.ok(!b.here.some((p) => p.id === agent.id), 'the agent is EXCLUDED from HERE');
  assert.ok(!b.here.some((p) => p.id === me.id), 'the viewer is not in their own list');
  assert.ok(b.nearby.some((p) => p.id === near1.id), 'the near-level human elsewhere is NEARBY');
  assert.ok(!b.nearby.some((p) => p.id === far1.id), 'the off-level whale is NOT nearby');
  assert.equal(b.onlineNow, 0, 'nobody online → onlineNow 0');
  assert.ok(b.here.every((p) => p.online === null), 'online status remains unknown');
  assert.equal(b.you.district, 'docks', 'the board carries your district');

  // ── HOT DISTRICTS: real humans per other district, viewer\'s own dropped ──
  assert.ok(b.hotDistricts.some((h) => h.district === 'canal'), 'canal (a near human) is a hot district');
  assert.ok(b.hotDistricts.some((h) => h.district === 'neon'), 'neon (the far human) is a hot district');
  assert.ok(!b.hotDistricts.some((h) => h.district === 'docks'), 'your OWN district is dropped from hot districts');

  // ── socket presence cannot refresh observations ──
  b = await collisionBoard(client, meCh, [here1.acct, near1.acct]);
  assert.equal(b.here.find((p) => p.id === here1.id).online, null, 'a local connection supplies no status');
  assert.equal(b.nearby.find((p) => p.id === near1.id).online, null, 'a remote connection supplies no status');
  assert.equal(b.onlineNow, 0, 'the board does not disclose live connection counts');

  // ── NO account UUID ever leaves (the rivals/cast discipline) ──
  for (const p of [...b.here, ...b.nearby]) assert.ok(!('account_id' in p), 'no account UUID surfaces on a card');

  // ══ observations survive private inactivity ═══════════════════════════════════════════════════
  const ghost = await mk('Ghost of Docks');
  await seedCh(ghost.id, "respect=185, loc='docks'");
  let ghostBefore = await collisionBoard(client, await chRow(me.id), []);
  assert.ok(!ghostBefore.here.some((p) => p.id === ghost.id), 'a newly created local player is unknown');
  await learn(ghost);
  ghostBefore = await collisionBoard(client, await chRow(me.id), []);
  assert.ok(ghostBefore.here.some((p) => p.id === ghost.id),
    'an explicitly learned local person is listed');

  // Private activity cannot change which last-known observations the viewer holds.
  const past = new Date(Date.now() - (DISCOVERY.SEEN_DAYS + 5) * 86400000);
  await pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [ghost.id, past]);
  const ghostAfter = await collisionBoard(client, await chRow(me.id), []);
  assert.ok(ghostAfter.here.some((p) => p.id === ghost.id), 'a stored observation remains when a player goes inactive');
  assert.ok(ghostAfter.here.some((p) => p.id === here1.id),
    'and the live human beside them is untouched by the gate (it filters the dormant, not the board)');

  // Arrivals still need an explicit encounter or gossip before an identity appears.
  const arrival = await mk('Just Arrived');
  await seedCh(arrival.id, "loc='docks'");   // level 1, zero respect, has done nothing at all
  const arrivalBoard = await collisionBoard(client, await chRow(me.id), []);
  assert.ok(!arrivalBoard.here.some((p) => p.id === arrival.id), 'a new arrival remains unknown');

  // District counts summarize stored sightings, so inactivity cannot update them either.
  await pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [far1.id, past]);
  const hot = await collisionBoard(client, await chRow(me.id), []);
  assert.ok(hot.hotDistricts.some((h) => h.district === 'neon'), 'the last-known neon sighting remains');
  const beforeMove = hot.here.find((p) => p.id === here1.id);
  await seedCh(here1.id, "loc='neon', respect=500000");
  const afterMove = (await collisionBoard(client, await chRow(me.id), [])).here.find((p) => p.id === here1.id);
  assert.equal(afterMove.district, 'docks', 'movement does not update the last-known district');
  assert.equal(afterMove.level, beforeMove.level, 'respect changes do not update the last-known level');
  assert.equal(new Date(afterMove.observedAt).getTime(), new Date(beforeMove.observedAt).getTime(), 'the observation age remains');
} finally { client.release(); }

// ── the route wires it (readCharacter + the online set) ──
const rb = (await call('GET', '/v1/live', { token: me.token })).body;
assert.ok(Array.isArray(rb.here) && Array.isArray(rb.nearby), 'GET /v1/live returns the board');
assert.ok(rb.here.some((p) => p.id === here1.id), 'the route surfaces the district human');

// ── §10.4: the whole surface moves no value ──
const inv = (await runLedgerInvariants(pool, { alert: false })).checks;
assert.equal(inv.find((c) => c.name === 'reason vocabulary').ok, true, 'no unknown reason (the collision writes nothing)');
assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM transactions WHERE reason LIKE 'collision%' OR reason LIKE 'live%'")).rows[0].n), 0, 'the collision surface writes zero ledger rows');

console.log('✅ THE COLLISION: earned sightings, residents+agents excluded, last-known districts, private status, §10.4-free');
process.exit(0);
