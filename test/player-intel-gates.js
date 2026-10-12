// Player intel is earned before an investigation can spend or disclose facts.
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { recordPlayerIntel, readPlayerIntel } from '../src/playerintel.js';
import { sendDm } from '../src/phone.js';

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, player, body) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await app.inject({ method, url,
      headers: player ? { authorization: `Bearer ${player.token}` } : {}, payload: body });
    const result = { code: res.statusCode, body: res.json() };
    // Native fixtures obey the production admission brake instead of disabling it.
    if (!process.env.DATABASE_URL || result.code !== 429 || result.body.error !== 'rate_limited' || attempt === 3)
      return result;
    const seconds = Number(res.headers['retry-after'] || result.body.cooldownSeconds || 3);
    await new Promise(resolve => setTimeout(resolve, Math.max(1000, seconds * 1000 + 100)));
  }
};
const mk = async (name, loc) => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  assert.equal((await call('POST', '/v1/character', { token }, { name })).code, 200);
  const { body: { character } } = await call('GET', '/v1/me', { token });
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [character.id, loc]);
  return { token, ...(await pool.query('SELECT * FROM characters WHERE id=$1', [character.id])).rows[0] };
};

try {
  const watcher = await mk('Careful Investigator', 'docks');
  const mark = await mk('Known Quarry', 'canal');
  const stranger = await mk('Unmet Stranger', 'foundry');
  const caller = await mk('Distant Caller', 'neon');
  await pool.query('UPDATE account_persistent SET omr=5000 WHERE account_id=$1', [watcher.account_id]);
  const omr = async () => Number((await pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [watcher.account_id])).rows[0].omr);
  const before = await omr();
  for (const path of ['tap', 'informant', 'dossier', 'watch', 'dig']) {
    const r = await call('POST', `/v1/wire/${path}/${stranger.id}`, watcher);
    assert.equal(r.body.error, 'unknown_player', `${path} refuses a never-learned target`);
    assert.equal(await omr(), before, `${path} cannot charge for a stranger`);
    assert(!JSON.stringify(r.body).includes(stranger.name), `${path} discloses no stranger identity`);
  }
  assert.equal((await call('POST', `/v1/streets/${stranger.id}/search`, watcher)).body.error, 'unknown_player');
  assert.equal((await pool.query('SELECT 1 FROM searches WHERE hunter=$1', [watcher.id])).rows.length, 0,
    'an unknown target cannot occupy the search slot');
  let blocked = await call('GET', `/v1/phone/thread/${stranger.id}`, caller);
  assert.equal(blocked.body.error, 'no_number', 'a thread cannot resolve an arbitrary stranger ID');
  assert(!JSON.stringify(blocked.body).includes(stranger.name), 'an unfamiliar thread reveals no name');
  blocked = await call('POST', `/v1/phone/block/${stranger.id}`, caller);
  assert.equal(blocked.code, 200, 'an unfamiliar ID can be blocked proactively');
  assert.equal(blocked.body.blocked, 'Unknown caller', 'blocking an unfamiliar ID reveals no name');
  assert.equal(await readPlayerIntel(pool, caller.account_id, stranger.id), null, 'blocking grants no intel');
  assert.equal((await pool.query('SELECT 1 FROM contacts WHERE owner_account=$1 AND contact_account=$2',
    [caller.account_id, stranger.account_id])).rows.length, 0, 'blocking grants no phone number');
  assert.equal((await call('GET', `/v1/phone/thread/${stranger.id}`, caller)).body.error, 'no_number',
    'proactive blocking never unlocks an unfamiliar thread');
  await pool.query("UPDATE characters SET name='Renamed Stranger' WHERE id=$1", [stranger.id]);
  blocked = await call('GET', '/v1/phone', caller);
  assert.equal(blocked.body.blocks.find((line) => line.characterId === stranger.id).name, 'Unknown caller');
  assert(!JSON.stringify(blocked.body).includes('Renamed Stranger'), 'the block list exposes no live stranger name');
  blocked = await call('DELETE', `/v1/phone/block/${stranger.id}`, caller);
  assert.equal(blocked.code, 200);
  assert.equal(blocked.body.unblocked, 'Unknown caller', 'unblocking exposes only the stored anonymous label');

  await recordPlayerIntel(pool, watcher.account_id, mark, { source: 'gossip', location: false });
  assert.equal((await readPlayerIntel(pool, watcher.account_id, mark.id)).loc, undefined,
    'an introduction grants identity without a district');
  assert.equal((await call('POST', `/v1/wire/tap/${mark.id}`, watcher)).code, 200);
  let snapshot = await readPlayerIntel(pool, watcher.account_id, mark.id);
  assert.equal(snapshot.source, 'wiretap');
  assert.equal(snapshot.loc, 'canal', 'a paid investigation earns a point-in-time district');
  await pool.query("UPDATE characters SET loc='brick' WHERE id=$1", [mark.id]);
  let r = await call('GET', '/v1/wire', watcher);
  assert.equal(r.code, 200, 'the read-only wire board remains readable');
  assert.equal(r.body.taps.find((t) => t.target === mark.id).loc, 'brick', 'an active paid wire reports current intel');
  assert.equal((await readPlayerIntel(pool, watcher.account_id, mark.id)).loc, 'canal',
    'reading surveillance does not silently refresh transferable sightings');
  assert.equal((await call('POST', `/v1/wire/tap/${mark.id}`, watcher)).code, 200);
  assert.equal((await readPlayerIntel(pool, watcher.account_id, mark.id)).loc, 'brick',
    'an explicit paid refresh records the new sighting');
  assert.equal((await call('POST', `/v1/wire/informant/${mark.id}`, watcher)).code, 200);
  assert.equal((await readPlayerIntel(pool, watcher.account_id, mark.id)).source, 'informant');
  assert.equal((await call('POST', `/v1/wire/dossier/${mark.id}`, watcher)).code, 200);
  assert.equal((await readPlayerIntel(pool, watcher.account_id, mark.id)).source, 'dossier');

  await pool.query('UPDATE account_persistent SET omr=500 WHERE account_id=$1', [caller.account_id]);
  await recordPlayerIntel(pool, caller.account_id, watcher, { source: 'gossip', location: false });
  assert.equal((await call('POST', `/v1/wire/tap/${watcher.id}`, caller)).code, 200);
  assert.equal(await readPlayerIntel(pool, watcher.account_id, caller.id), null,
    'being watched alone discloses no watcher identity');
  assert.equal((await call('POST', '/v1/wire/trace', watcher)).code, 200);
  snapshot = await readPlayerIntel(pool, watcher.account_id, caller.id);
  assert.equal(snapshot.source, 'trace', 'paid counter-intel learns who watched you');
  assert.equal(snapshot.loc, undefined, 'a watcher trace supplies no sighting');
  assert.equal(snapshot.level, undefined, 'a watcher trace supplies no level');

  await pool.query("INSERT INTO contacts (owner_account, contact_account, how) VALUES ($1,$2,'met')",
    [caller.account_id, stranger.account_id]);
  assert.equal((await call('POST', `/v1/phone/dm/${stranger.id}`, caller, { text: 'We should talk.' })).code, 200);
  snapshot = await readPlayerIntel(pool, stranger.account_id, caller.id);
  assert.equal(snapshot.name, caller.name);
  assert.equal(snapshot.source, 'called');
  assert.equal(snapshot.loc, undefined, 'a call supplies no caller location');
  assert.equal(snapshot.level, undefined, 'a call supplies no caller level');
  await pool.query('DELETE FROM contacts WHERE owner_account=$1 AND contact_account=$2',
    [stranger.account_id, caller.account_id]);
  r = await call('GET', `/v1/phone/thread/${caller.id}`, stranger);
  assert.equal(r.code, 200, 'a real prior conversation remains readable without a legacy contact row');
  assert.equal(r.body.messages.length, 1);
  assert.equal((await call('POST', `/v1/phone/block/${caller.id}`, stranger)).code, 200,
    'a caller can still be blocked after a real message');

  const noteSender = await mk('Note Failure Sender', 'neon');
  const noteRecipient = await mk('Note Failure Reader', 'canal');
  await pool.query("INSERT INTO contacts (owner_account, contact_account, how) VALUES ($1,$2,'met')",
    [noteSender.account_id, noteRecipient.account_id]);
  let failedNotes = 0;
  const failingIntelPool = { query: async (sql, args) => {
    if (/^\s*INSERT INTO player_intel\b/i.test(sql)) {
      failedNotes += 1;
      throw new Error('injected intel note failure');
    }
    return pool.query(sql, args);
  } };
  const sent = await sendDm(failingIntelPool, noteSender.account_id, noteRecipient.id, 'The line still lands.');
  assert.equal(failedNotes, 1, 'the fault injection exercised the caller intel write');
  assert.equal(sent.ok, true, 'a committed DM succeeds when its auxiliary intel note fails');
  const landed = (await pool.query('SELECT body FROM dm_messages WHERE id=$1 AND from_account=$2 AND to_account=$3',
    [sent.id, noteSender.account_id, noteRecipient.account_id])).rows;
  assert.equal(landed[0]?.body, 'The line still lands.', 'the successful DM response refers to a persisted message');
  assert.equal(await readPlayerIntel(pool, noteRecipient.account_id, noteSender.id), null,
    'the note really failed while the message remained delivered');

  await pool.query("UPDATE characters SET gun='orchestra', ammo=500, energy=200, jail_until=NULL, hosp_until=NULL, shoot_cd_until=NULL WHERE id=$1", [watcher.id]);
  assert.equal((await call('POST', `/v1/streets/${mark.id}/search`, watcher)).code, 200);
  await pool.query('UPDATE searches SET started_at=$1 WHERE hunter=$2',
    [new Date(Date.now() - 86400000), watcher.id]);
  r = await call('POST', `/v1/streets/${mark.id}/fire`, watcher, { rounds: 50 });
  assert.equal(r.body.error, 'district');
  assert.equal(r.body.district, undefined, 'a failed shot cannot reveal the victim district');
  assert(!JSON.stringify(r.body).includes('brick'), 'a lost tail reveals no current district in text');
  console.log('player-intel-gates: unknown targets do not spend or leak, paid sightings are deliberate, and calls reveal identity only.');
} finally {
  await app.close();
}
