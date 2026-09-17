// Mounted gateway proof: existing sockets rederive membership after real HTTP writes,
// and stale private subscriptions fail closed even when a writer bypasses HTTP.
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { bus, withCharacter } from '../src/game.js';
import { createCrew, inviteToCrew, acceptInvite, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang } from '../src/social.js';

assert(!process.env.DATABASE_URL, 'Only isolated in-memory gateway fixture');
const envNames = ['WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_ACCOUNT_IDS', 'RATE_LIMIT'];
const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
for (const name of envNames.slice(0, 4)) process.env[name] = 'on';
process.env.COORDINATION_ACCOUNT_IDS = 'ws-owner,ws-reader,ws-outsider'; process.env.RATE_LIMIT = 'off';
const baseline = [bus.listenerCount('world:changed'), bus.listenerCount('coordination:changed')];
const app = await buildServer(), sockets = [];
const token = (id) => app.jwt.sign({ sub: id, tv: 0 });
const social = (id, action, hooks) => withCharacter(app.pool, id, action, hooks);
const call = (method, url, accountId, payload = {}) => app.inject({ method, url, payload,
  headers: { authorization: `Bearer ${token(accountId)}` } });
async function player(id, name) {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$3,1,'foundry',10000,100000)", [`${id}-ch`, id, name]);
}
function until(socket, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const done = (event) => {
      const value = type === 'message' ? JSON.parse(event.data) : event;
      if (!predicate(value)) return;
      clearTimeout(timer); socket.removeEventListener(type, done); resolve(value);
    };
    const timer = setTimeout(() => { socket.removeEventListener(type, done); reject(Error(`Timed out waiting for ${type}`)); }, 5000);
    socket.addEventListener(type, done);
  });
}
const dispatch = (channel, event) => Promise.all(bus.listeners(channel).map((listener) => listener(event)));
try {
  await player('ws-owner', 'WS Owner'); await player('ws-reader', 'WS Reader'); await player('ws-outsider', 'WS Outsider');
  const crew = await social('ws-owner', (ch, client, h) => createCrew(ch, 'Socket Crew', client, h));
  const family = await social('ws-owner', (ch, client, h) => createGang(ch, 'Socket Family', 'SOCK', client, h));
  await social('ws-owner', (ch, client, h) => inviteToCrew(ch, 'WS Reader', client, h), CREW_FIRST_CHARACTER_LOCKS);
  await social('ws-reader', (ch, client, h) => acceptInvite(ch, crew.id, client, h));
  await social('ws-reader', (ch, client, h) => joinGang(ch, family.gangId, client, h));
  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  // Keep the server's existing WebSocket authentication/subprotocol path.
  const open = async (accountId) => {
    const socket = new WebSocket(origin.replace(/^http/, 'ws') + '/v1/ws', ['bearer', token(accountId)]);
    socket.messages = []; socket.addEventListener('message', (event) => socket.messages.push(JSON.parse(event.data)));
    sockets.push(socket); await until(socket, 'message', (event) => event.channel === 'hello'); return socket;
  };
  const owner = await open('ws-owner'), reader = await open('ws-reader'), outsider = await open('ws-outsider');
  const first = until(reader, 'message', (event) => event.private === 'before-departure');
  await dispatch(`crew:${crew.id}`, { type: 'fixture', private: 'before-departure' }); await first;
  const closed = until(reader, 'close'), hint = until(owner, 'message', (event) => event.channel === 'projection');
  const left = await call('POST', '/v1/crew/leave', 'ws-reader'); assert.equal(left.statusCode, 200, left.body);
  assert.equal((await closed).code, 4009); assert.deepEqual(await hint, { channel: 'projection', changed: true });
  const after = await open('ws-reader');
  await dispatch(`crew:${crew.id}`, { type: 'fixture', private: 'after-departure' });
  assert(!after.messages.some((event) => event.private === 'after-departure'));
  assert(!outsider.messages.some((event) => event.channel === 'projection' || event.channel === 'crew'));

  // Successful join must refresh subscriptions too, rather than waiting for an
  // unrelated disconnect. The membership change itself uses the real HTTP route.
  await social('ws-owner', (ch, client, h) => inviteToCrew(ch, 'WS Reader', client, h), CREW_FIRST_CHARACTER_LOCKS);
  const rejoinedClose = until(after, 'close');
  const joined = await call('POST', `/v1/crew/accept/${crew.id}`, 'ws-reader'); assert.equal(joined.statusCode, 200, joined.body);
  assert.equal((await rejoinedClose).code, 4009);
  const rejoined = await open('ws-reader');
  const regained = until(rejoined, 'message', (event) => event.private === 'rejoined');
  await dispatch(`crew:${crew.id}`, { type: 'fixture', private: 'rejoined' }); await regained;

  // A non-HTTP committed writer leaves the old subscription installed. Current
  // membership revalidation must suppress its next private event and close it.
  await app.pool.query('DELETE FROM gang_members WHERE character_id=$1', ['ws-reader-ch']);
  const staleClose = until(rejoined, 'close');
  await dispatch(`gang:${family.gangId}`, { type: 'fixture', private: 'forbidden-after-kick' });
  assert.equal((await staleClose).code, 4009);
  assert(!rejoined.messages.some((event) => event.private === 'forbidden-after-kick'));
  for (const socket of sockets) for (const event of socket.messages.filter((value) => value.channel === 'projection')) {
    assert.deepEqual(event, { channel: 'projection', changed: true });
  }
  console.log('projection-events-ws: actual Crew leave/rejoin, stale Family feed suppression and coarse socket hints pass');
} finally {
  for (const socket of sockets) if (socket.readyState < 2) socket.close();
  await app.close();
  assert.deepEqual([bus.listenerCount('world:changed'), bus.listenerCount('coordination:changed')], baseline);
  for (const [name, value] of Object.entries(previous)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
}
