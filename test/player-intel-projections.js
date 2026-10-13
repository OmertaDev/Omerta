import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { recordPlayerIntel, readPlayerIntel, sharePlayerIntel } from '../src/playerintel.js';
import { DISCOVERY } from '../src/rules.js';
import { contactsBoard, recordMeeting } from '../src/contacts.js';
import { peopleBoard, pairHistory } from '../src/people.js';
import { circleBoard } from '../src/circle.js';
import { rivalsBoard } from '../src/rivals.js';
import { discoveryBoard } from '../src/discovery.js';
import { collisionBoard } from '../src/collision.js';
import { crewBoard } from '../src/crew.js';

const app = await buildServer();
const pool = app.pool;
const make = async (name) => {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const created = await app.inject({ method: 'POST', url: '/v1/character',
    headers: { authorization: `Bearer ${token}` }, payload: { name } });
  assert.equal(created.statusCode, 200);
  const id = (await app.inject({ method: 'GET', url: '/v1/me',
    headers: { authorization: `Bearer ${token}` } })).json().character.id;
  await pool.query("UPDATE characters SET respect=500, loc='docks' WHERE id=$1", [id]);
  return { ...(await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0], token };
};

try {
  const owner = await make('Intel Reader');
  const mark = await make('Intel Neighbor');
  const stranger = await make('Intel Stranger');
  let discovery = await discoveryBoard(owner, pool, [mark.account_id]);
  let collision = await collisionBoard(pool, owner, [mark.account_id]);
  assert.deepEqual(discovery.peers, [], 'creating nearby players grants no identities');
  assert.deepEqual(discovery.newcomers, [], 'newcomer discovery grants no identities');
  assert.deepEqual(collision.here, [], 'being local grants no identity before a meeting');
  assert.deepEqual(collision.nearby, []);
  assert.deepEqual(collision.hotDistricts, [], 'no global population radar');
  await assert.rejects(pairHistory(pool, owner, stranger.id), (e) => e.code === 'unknown_player');

  const observedAt = new Date(Date.now() - 60_000);
  const seen = await recordPlayerIntel(pool, owner.account_id, mark, { observedAt });
  await recordMeeting(pool, owner.account_id, mark.account_id);
  await pool.query('INSERT INTO mentorships (protege_account, mentor_account) VALUES ($1,$2)',
    [owner.account_id, mark.account_id]);
  await pool.query('INSERT INTO crews (id, name, leader_account) VALUES ($1,$2,$3)',
    ['intel-projection-crew', 'Intel Projection Crew', owner.account_id]);
  await pool.query('INSERT INTO crew_members (crew_id, account_id, name) VALUES ($1,$2,$3),($1,$4,$5)',
    ['intel-projection-crew', owner.account_id, owner.name, mark.account_id, mark.name]);
  await pool.query('INSERT INTO rival_events (id, victim_account, aggressor_account, kind, detail) VALUES ($1,$2,$3,$4,$5)',
    [crypto.randomUUID(), owner.account_id, mark.account_id, 'jump', '{}']);
  await pool.query("UPDATE characters SET name='Intel Renamed', respect=80000, loc='neon', jail_until=now()+interval '1 hour', wanted_until=now()+interval '1 hour' WHERE id=$1", [mark.id]);

  const assertStored = (card, locationKey = 'loc') => {
    assert.equal(card.name, seen.name, 'stored identity is not silently refreshed');
    assert.equal(card.level, seen.level, 'level comes from the observation');
    assert.equal(card[locationKey], 'docks', 'movement does not update learned location');
    assert.equal(new Date(card.observedAt).getTime(), observedAt.getTime(), 'the observation keeps its age');
  };
  const txBefore = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  assertStored((await contactsBoard(pool, owner.account_id)).contacts.find((r) => r.street?.id === mark.id).street);
  assertStored((await rivalsBoard(pool, owner.account_id)).rivals[0].street);
  assertStored((await peopleBoard(pool, owner)).nemesis.street);
  assertStored((await pairHistory(pool, owner, mark.id)).them.face);
  const member = (await circleBoard(pool, owner, [mark.account_id])).people[0];
  assertStored(member, 'district');
  for (const status of ['online', 'jailed', 'hospital', 'wanted'])
    assert.equal(member[status], null, 'relationships grant no live status');
  const crew = (await crewBoard(owner, pool)).crew;
  assertStored(crew.members.find((r) => r.characterId === mark.id), 'district');
  assert.equal(crew.members.find((r) => r.isMe).district, owner.loc, 'own location stays current');
  assert.equal(crew.members.find((r) => r.characterId === mark.id).family, null, 'membership grants no live family tracking');

  discovery = await discoveryBoard(owner, pool, [mark.account_id], { district: 'docks' });
  assertStored(discovery.peers[0], 'district');
  assert.equal(discovery.peers[0].online, null);
  assert.deepEqual((await discoveryBoard(owner, pool, [], { district: 'neon' })).peers, [],
    'filtering cannot reveal a current location');
  assert.deepEqual((await discoveryBoard(owner, pool, [mark.account_id], { online: true })).peers, [],
    'filtering cannot reveal socket presence');
  collision = await collisionBoard(pool, owner, [mark.account_id]);
  assertStored(collision.here[0], 'district');
  assert.equal(collision.onlineNow, 0);
  assert.equal(collision.here[0].wanted, null);

  // Existing phone books retain identity without inventing a historical sighting.
  await recordMeeting(pool, owner.account_id, stranger.account_id);
  const legacy = (await contactsBoard(pool, owner.account_id)).contacts.find((r) => r.street?.id === stranger.id).street;
  assert.equal(legacy.name, stranger.name);
  assert.equal(legacy.level, null);
  assert.equal(legacy.loc, null);
  assert.equal(legacy.observedAt, null);
  assert.equal((await discoveryBoard(owner, pool)).peers.some((r) => r.id === stranger.id), false);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), txBefore,
    'projections never write value');

  const advertiser = await make('Intel Recruiter');
  const listener = await make('Intel Hearer');
  const adAt = new Date(Date.now() - DISCOVERY.LFG_TTL_MS + 60_000);
  await pool.query('UPDATE characters SET lfg=true, lfg_at=$2 WHERE id=$1', [advertiser.id, adAt]);
  const ad = (await pool.query('SELECT * FROM characters WHERE id=$1', [advertiser.id])).rows[0];
  assert.equal((await discoveryBoard(owner, pool)).looking.some((row) => row.id === advertiser.id), false,
    'an unfamiliar advertisement supplies no identity or recruiting intent');
  const phoneNote = await recordPlayerIntel(pool, listener.account_id, ad,
    { source: 'called', location: false, observedAt: new Date(adAt.getTime() - 1) });
  assert.equal(phoneNote.lfg, undefined, 'a phone introduction invents no recruiting intent');
  assert.equal(phoneNote.lfgAt, undefined);
  const met = await app.inject({ method: 'POST', url: `/v1/streets/${advertiser.id}/meet`,
    headers: { authorization: `Bearer ${owner.token}` } });
  assert.equal(met.statusCode, 200, 'an actual encounter can learn the advertisement');
  const adNote = await readPlayerIntel(pool, owner.account_id, advertiser.id);
  assert.equal(adNote.lfg, true);
  assert.equal(adNote.lfgAt, adAt.toISOString(), 'the observation keeps the original advertisement time');
  assert.equal((await discoveryBoard(owner, pool)).looking.find((row) => row.id === advertiser.id).lfg, true);

  await pool.query("UPDATE characters SET lfg=false, lfg_at=now(), respect=80000, loc='neon', active_at=now() WHERE id=$1", [advertiser.id]);
  await recordMeeting(pool, owner.account_id, listener.account_id);
  await sharePlayerIntel(owner, listener.id, advertiser.id, pool);
  assert.equal((await readPlayerIntel(pool, listener.account_id, advertiser.id)).lfgAt, adAt.toISOString(),
    'owned gossip preserves the advertisement time instead of renewing it');
  const originalNow = Date.now;
  try {
    Date.now = () => adAt.getTime() + DISCOVERY.LFG_TTL_MS - 1;
    for (const viewer of [owner, listener]) {
      const notice = (await discoveryBoard(viewer, pool)).looking.find((row) => row.id === advertiser.id);
      assert(notice, 'a learned advertisement remains visible until its original deadline');
      assert.equal(notice.district, 'docks', 'later movement does not refresh an advertisement');
      assert.equal(notice.level, adNote.level, 'later leveling does not change the learned recruiting band');
      assert.equal(notice.lfgAt, adAt.toISOString());
      assert.equal(new Date(notice.observedAt).getTime(), new Date(adNote.observedAt).getTime());
    }
    Date.now = () => adAt.getTime() + DISCOVERY.LFG_TTL_MS;
    for (const viewer of [owner, listener]) {
      const expired = await discoveryBoard(viewer, pool);
      assert.equal(expired.looking.some((row) => row.id === advertiser.id), false,
        'the original advertisement stamp controls expiry, even after gossip');
      assert.equal(expired.peers.find((row) => row.id === advertiser.id).lfg, null);
    }
  } finally { Date.now = originalNow; }
  console.log('Player intel projections preserve earned identities and dated observations.');
} finally {
  await app.close();
}
