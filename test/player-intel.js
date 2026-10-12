import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { bus, withTwoCharacters } from '../src/game.js';
import { recordContact } from '../src/contacts.js';
import { recordPlayerIntel, readPlayerIntel, playerIntelMap, playerIntelBoard,
  requireKnownPlayer, sharePlayerIntel, meetPlayer } from '../src/playerintel.js';

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, token, body) => {
  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  return { code: res.statusCode, body: res.json() };
};
const create = async (name) => {
  const auth = await call('POST', '/v1/auth/guest');
  const token = auth.body.token;
  const born = await call('POST', '/v1/character', token, { name });
  assert.equal(born.code, 200);
  const me = (await call('GET', '/v1/me', token)).body.character;
  const ch = (await pool.query('SELECT * FROM characters WHERE id=$1', [me.id])).rows[0];
  return { token, ch };
};
const millis = (value) => new Date(value).getTime();
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error.code === code);

try {
  const a = await create('Intel Witness');
  const b = await create('Intel Gossip');
  const target = await create('Intel Mark');
  const remote = await create('Intel Remote');
  await pool.query('UPDATE characters SET loc=$1 WHERE id=$2', ['canal', remote.ch.id]);
  remote.ch.loc = 'canal';

  let board = await call('GET', '/v1/streets', a.token);
  assert.equal(board.code, 200);
  assert(!board.body.streets.some((row) => row.id === remote.ch.id), 'undiscovered remote players are absent');
  const stranger = board.body.streets.find((row) => row.id === target.ch.id);
  assert(stranger?.nearby, 'a nearby stranger can be approached');
  assert.equal(stranger.name, null);
  assert.equal(stranger.loc, null);
  assert.equal(stranger.level, null);
  assert(!JSON.stringify(stranger).includes(target.ch.account_id), 'account identifiers never enter intel');
  await rejectsCode(requireKnownPlayer(pool, a.ch, remote.ch.id), 'unknown_player');
  await rejectsCode(withTwoCharacters(pool, a.ch.account_id, remote.ch.id,
    async () => ({ ok: true }), { meet: false, requireKnown: true }), 'unknown_player');
  let result = await call('POST', `/v1/streets/${remote.ch.id}/meet`, a.token);
  assert.equal(result.body.error, 'unknown_player', 'guessing a remote ID cannot introduce a player');

  result = await call('POST', `/v1/streets/${target.ch.id}/meet`, a.token);
  assert.equal(result.code, 200, JSON.stringify(result.body));
  const seen = await readPlayerIntel(pool, a.ch.account_id, target.ch.id);
  assert.equal(seen.name, target.ch.name);
  assert.equal(seen.loc, 'docks');
  assert.equal(seen.level, 1);
  assert(await readPlayerIntel(pool, target.ch.account_id, a.ch.id), 'meeting records both sides');
  await requireKnownPlayer(pool, a.ch, target.ch.id);
  const movementEvents = [];
  const collectMovement = (event) => movementEvents.push(event);
  bus.on('streets', collectMovement);
  try {
    const move = await call('POST', '/v1/travel/neon', target.token);
    assert.equal(move.code, 200, JSON.stringify(move.body));
  } finally { bus.off('streets', collectMovement); }
  assert(!movementEvents.some((event) => event.type === 'arrival' || event.cid === target.ch.id),
    'travel never broadcasts a player location on the global feed');
  await pool.query('UPDATE characters SET respect=$1 WHERE id=$2', [10000, target.ch.id]);
  board = await call('GET', '/v1/streets', a.token);
  const stale = board.body.streets.find((row) => row.id === target.ch.id);
  assert.equal(stale.loc, 'docks', 'reading does not disclose a new location');
  assert.equal(stale.level, seen.level, 'reading does not disclose a new level');
  assert.equal(millis(stale.observedAt), millis(seen.observedAt));
  assert(!stale.nearby, 'a distant known player has no live presence marker');
  await recordPlayerIntel(pool, a.ch.account_id, target.ch, { source: 'phone', location: false });
  assert.equal(millis((await readPlayerIntel(pool, a.ch.account_id, target.ch.id)).observedAt), millis(seen.observedAt),
    'a call preserves an older located observation and its age');

  result = await call('POST', `/v1/streets/${b.ch.id}/meet`, a.token);
  assert.equal(result.code, 200);
  result = await call('POST', `/v1/intel/share/${b.ch.id}`, a.token, { targetId: target.ch.id });
  assert.equal(result.code, 200, JSON.stringify(result.body));
  assert.equal(result.body.intel.source, 'gossip');
  assert.equal(result.body.intel.sourceName, a.ch.name);
  assert.equal(result.body.intel.loc, 'docks', 'gossip copies the witness notes, not live state');
  assert.equal(millis(result.body.intel.observedAt), millis(seen.observedAt), 'hearsay preserves sighting age');
  assert(!JSON.stringify(result.body.intel).includes(a.ch.account_id));
  assert(!JSON.stringify(result.body.intel).includes(target.ch.account_id));
  await rejectsCode(sharePlayerIntel(a.ch, b.ch.id, remote.ch.id, pool), 'unknown_player');
  const freshTime = new Date(millis(seen.observedAt) + 60_000);
  await recordPlayerIntel(pool, b.ch.account_id, { ...target.ch, loc: 'neon' }, { observedAt: freshTime });
  let notices = 0;
  const newest = await sharePlayerIntel(a.ch, b.ch.id, target.ch.id, pool, { notify: async () => { notices++; } });
  assert.equal(newest.intel.loc, 'docks', 'a gossip acknowledgement cannot reveal the recipient notes');
  assert.equal(millis(newest.intel.observedAt), millis(seen.observedAt));
  assert.equal((await readPlayerIntel(pool, b.ch.account_id, target.ch.id)).loc, 'neon',
    'old gossip cannot overwrite a newer observation');
  assert.equal(notices, 0, 'unchanged notes generate no notification');
  await recordContact(pool, remote.ch.account_id, a.ch.account_id, 'called');
  await recordPlayerIntel(pool, remote.ch.account_id, target.ch,
    { source: 'called', location: false, observedAt: freshTime });
  const identityGossip = await sharePlayerIntel(remote.ch, a.ch.id, target.ch.id, pool);
  assert.equal(identityGossip.intel.loc, undefined, 'sharing identity does not return recipient whereabouts');
  assert.equal((await readPlayerIntel(pool, a.ch.account_id, target.ch.id)).loc, 'docks',
    'a newer identity-only rumor never erases a dated sighting');

  await pool.query('INSERT INTO dm_blocks (blocker_account,blocked_account,name) VALUES ($1,$2,$3)',
    [b.ch.account_id, a.ch.account_id, a.ch.name]);
  await rejectsCode(sharePlayerIntel(a.ch, b.ch.id, target.ch.id, pool), 'blocked');
  await pool.query('DELETE FROM dm_blocks WHERE blocker_account=$1', [b.ch.account_id]);
  await pool.query('INSERT INTO dm_blocks (blocker_account,blocked_account,name) VALUES ($1,$2,$3)',
    [a.ch.account_id, b.ch.account_id, b.ch.name]);
  await rejectsCode(sharePlayerIntel(a.ch, b.ch.id, target.ch.id, pool), 'you_blocked');
  await pool.query('DELETE FROM dm_blocks WHERE blocker_account=$1', [a.ch.account_id]);

  // A named interpersonal relationship is an introduction, without a free location snapshot.
  await pool.query('INSERT INTO mentorships (mentor_account,protege_account) VALUES ($1,$2)',
    [a.ch.account_id, remote.ch.account_id]);
  await requireKnownPlayer(pool, a.ch, remote.ch.id);
  await requireKnownPlayer(pool, remote.ch, a.ch.id);
  assert.equal(await readPlayerIntel(pool, a.ch.account_id, remote.ch.id), null,
    'a mentor relationship does not manufacture a current sighting');
  assert(!(await playerIntelBoard(pool, a.ch)).streets.some((row) => row.id === remote.ch.id));
  await pool.query('DELETE FROM mentorships WHERE protege_account=$1', [remote.ch.account_id]);
  await rejectsCode(requireKnownPlayer(pool, a.ch, remote.ch.id), 'unknown_player');
  const crewId = crypto.randomUUID();
  await pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
    [crewId, 'Intel Test Crew', a.ch.account_id]);
  await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3),($1,$4,$5)',
    [crewId, a.ch.account_id, a.ch.name, remote.ch.account_id, remote.ch.name]);
  await requireKnownPlayer(pool, a.ch, remote.ch.id);
  await requireKnownPlayer(pool, remote.ch, a.ch.id);
  assert.equal(await readPlayerIntel(pool, a.ch.account_id, remote.ch.id), null,
    'a crew relationship introduces identity without a current sighting');
  await pool.query('DELETE FROM crew_members WHERE crew_id=$1', [crewId]);
  await pool.query('DELETE FROM crews WHERE id=$1', [crewId]);
  await rejectsCode(requireKnownPlayer(pool, a.ch, remote.ch.id), 'unknown_player');

  // Existing phone books establish identity only. Incoming calls work the same way.
  await recordContact(pool, a.ch.account_id, remote.ch.account_id, 'called');
  let legacy = (await playerIntelBoard(pool, a.ch)).streets.find((row) => row.id === remote.ch.id);
  assert.equal(legacy.name, remote.ch.name);
  assert.equal(legacy.loc, null);
  assert.equal(legacy.level, null);
  await requireKnownPlayer(pool, a.ch, remote.ch.id);
  const identity = await recordPlayerIntel(pool, a.ch.account_id, remote.ch, { source: 'phone', location: false });
  assert.equal(identity.loc, undefined);
  assert.equal(identity.level, undefined);

  // Stored sightings remain attached to the observed character after death, even with an heir.
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [target.ch.id]);
  const heir = crypto.randomUUID();
  await pool.query('INSERT INTO characters (id,account_id,name,loc,season) VALUES ($1,$2,$3,$4,$5)',
    [heir, target.ch.account_id, 'Intel Heir', 'canal', target.ch.season]);
  const historical = (await playerIntelBoard(pool, a.ch)).streets;
  assert.equal(historical.find((row) => row.id === target.ch.id).name, target.ch.name);
  assert(!historical.some((row) => row.id === heir), 'a legacy phone line does not substitute an unknown heir');
  const map = await playerIntelMap(pool, a.ch.account_id);
  assert.equal(map.get(target.ch.id).loc, 'docks');
  await rejectsCode(meetPlayer({ ...a.ch, jail_until: new Date(Date.now() + 60_000) }, b.ch), 'jailed');
  await rejectsCode(meetPlayer(a.ch, { ...b.ch, hosp_until: new Date(Date.now() + 60_000) }), 'unavailable');

  console.log('player intel: discovery, stale observations, gossip, phone identity and historical sightings passed');
} finally {
  await app.close();
  await pool.end();
}
