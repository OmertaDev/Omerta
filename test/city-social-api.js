// Real authenticated HTTP, replay and private social projections. --postgres uses an isolated local schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { CITY_SOCIAL_SCHEMAS } from '../src/city-social-contract.js';
import { withTwoCharacters, bus } from '../src/game.js';
import { runEstate } from '../src/social/estate.js';
import { sendNearbyCityChat } from '../src/city-social.js';

const postgres = process.argv.includes('--postgres');
let basePool, namespace;
if (postgres) {
  const address = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
  assert(address, 'An explicit isolated PostgreSQL test URL is required.');
  const endpoint = new URL(address);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg');
  basePool = new Pool({ connectionString: endpoint.toString() });
  namespace = 'city_social_' + crypto.randomBytes(8).toString('hex');
  assert(/^[a-z_0-9]+$/.test(namespace));
  await basePool.query(`CREATE SCHEMA ${namespace}`);
  endpoint.searchParams.set('options', `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=20000`);
  process.env.DATABASE_URL = endpoint.toString();
} else assert(!process.env.DATABASE_URL, 'Without --postgres, require disposable pg-mem.');
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';
const { buildServer } = await import('../src/server.js');
const app = await buildServer();
const validator = new Ajv({ strict: false, allErrors: true }); addFormats(validator);
const typed = name => validator.compile({ $ref: '#/components/schemas/' + name, components: { schemas: CITY_SOCIAL_SCHEMAS } });
const validateBoard = typed('CitySocialBoard'), validateUpdated = typed('CitySocialUpdated');
const validateNearby = typed('CityNearbyBoard'), validateSent = typed('CityNearbySent');
const id = () => crypto.randomUUID();
const json = response => response.json();
const privateHeaders = response => {
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert(/authorization/i.test(response.headers.vary || ''));
};
async function actor(name, kind = 'player') {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
  assert.equal(guest.statusCode, 200, guest.body);
  const token = guest.json().token, account = app.jwt.verify(token).sub;
  const headers = { authorization: 'Bearer ' + token };
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
  assert.equal(created.statusCode, 200, created.body);
  const character = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [account])).rows[0].id;
  await app.pool.query("UPDATE characters SET loc='docks',is_npc=$2,last_accrued_at=$3 WHERE id=$1", [character, kind === 'npc', new Date(Date.now() + 86400000)]);
  if (kind === 'agent') await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [account]);
  return { id: character, account, headers, name };
}
const get = (a, url) => app.inject({ url, headers: a.headers });
const post = (a, url, payload, key = id()) => app.inject({ method: 'POST', url, headers: { ...a.headers, 'idempotency-key': key }, payload });
const social = async a => {
  const response = await get(a, '/v1/city/social'); assert.equal(response.statusCode, 200, response.body); privateHeaders(response);
  const body = json(response); assert.equal(validateBoard(body), true, JSON.stringify(validateBoard.errors)); return body;
};
const join = async a => { const body = await social(a); const response = await post(a, '/v1/city/social/preferences', { ...body.viewer, chatEnabled: true }); assert.equal(response.statusCode, 200, response.body); return body.viewer; };
const neutral = async () => ({
  characters: (await app.pool.query('SELECT id,cash,bank,respect,health,energy,nerve,heat,muscle,cunning,speed,gun,vest FROM characters ORDER BY id')).rows,
  accounts: (await app.pool.query('SELECT account_id,omr,staked FROM account_persistent ORDER BY account_id')).rows,
  ledger: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n),
});
const snapshot = async () => ({ prefs: (await app.pool.query('SELECT * FROM city_social_preferences ORDER BY character_id,generation')).rows,
  messages: (await app.pool.query('SELECT * FROM chat_messages ORDER BY id')).rows });
const pause = () => new Promise(resolve => setTimeout(resolve, 2100));
async function interceptedQueries(action, intercept) {
  const connect = app.pool.connect;
  app.pool.connect = async function (...args) {
    const client = await connect.apply(this, args);
    return new Proxy(client, { get(target, property) {
      if (property === 'query') return (sql, params) => intercept(sql, params, () => target.query(sql, params));
      const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  try { return await action(); } finally { app.pool.connect = connect; }
}
try {
  const a = await actor('Social Alpha'), b = await actor('Social Bravo'), c = await actor('Social Charlie');
  const npc = await actor('Social Resident', 'npc'), machine = await actor('Social Agent', 'agent');
  for (const url of ['/v1/city/social', '/v1/city/nearby-chat']) {
    const response = await app.inject({ url }); assert.equal(response.statusCode, 401); privateHeaders(response);
  }
  assert.equal((await get(npc, '/v1/city/social')).statusCode, 400, 'A resident cannot invent human social participation.');
  const baseline = await neutral(), defaultBoard = await social(a);
  assert.deepEqual(defaultBoard.preferences, { outfit: 'classic', chatEnabled: false, room: { furniture: [] } });
  assert.equal((await get(a, defaultBoard.chat.readPath)).statusCode, 403, 'Opt-out cannot receive a feed.');
  assert.equal((await get(a, defaultBoard.chat.readPath + '&channel=city')).statusCode, 400, 'Reads cannot select another room.');
  assert.equal((await post(a, '/v1/city/nearby-chat', { ...defaultBoard.viewer, text: 'Not joined' })).statusCode, 403);
  for (const extra of [{ accountId: b.account }, { sender: b.id }, { channel: 'city' }, { cash: 1 }, { authority: 'owner' }]) {
    assert.equal((await post(a, '/v1/city/social/preferences', { ...defaultBoard.viewer, outfit: 'moss', ...extra })).statusCode, 400);
    assert.equal((await post(a, '/v1/city/nearby-chat', { ...defaultBoard.viewer, text: 'Spoof', ...extra })).statusCode, 400);
  }
  assert.equal((await get(a, '/v1/city/social?accountId=' + encodeURIComponent(b.account))).statusCode, 400);
  for (const wrong of [{ characterId: b.id }, { generation: 2 }, { district: 'foundry' }]) {
    assert.equal((await post(a, '/v1/city/social/preferences', { ...defaultBoard.viewer, outfit: 'moss', ...wrong })).statusCode, 409);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/v1/city/social/preferences', headers: a.headers,
    payload: { ...defaultBoard.viewer, outfit: 'moss' } })).statusCode, 400, 'Writes require their guarded request key.');
  const layout = { furniture: [{ id: 'chair', x: 1, y: 1, rotation: 1 }, { id: 'lamp', x: 3, y: 2 }] };
  const preferenceKey = id();
  const payload = { ...defaultBoard.viewer, outfit: 'moss', room: layout };
  const saved = await post(a, '/v1/city/social/preferences', payload, preferenceKey);
  assert.equal(saved.statusCode, 200, saved.body); assert.equal(validateUpdated(saved.json()), true);
  assert.equal(saved.json().preferences.room.furniture[1].rotation, 0);
  const replayPrefs = await post(a, '/v1/city/social/preferences', payload, preferenceKey);
  assert.equal(replayPrefs.body, saved.body, 'Completed preference replay preserves exact reply bytes.');
  assert.deepEqual(replayPrefs.json(), saved.json()); assert.equal(replayPrefs.headers['x-idempotent-replay'], 'true');
  assert.equal((await post(a, '/v1/city/social/preferences', { ...payload, outfit: 'wine' }, preferenceKey)).statusCode, 422);
  for (const room of [{ furniture: [{ id: 'chair', x: 6, y: 0 }] },
    { furniture: [{ id: 'vault', x: 0, y: 0 }] }, { furniture: [{ id: 'chair', x: 0, y: 0, rotation: 4 }] },
    { furniture: [{ id: 'chair', x: 0, y: 0 }, { id: 'lamp', x: 0, y: 0 }] }]) {
    const before = await snapshot();
    assert.equal((await post(a, '/v1/city/social/preferences', { ...defaultBoard.viewer, room })).statusCode, 400);
    assert.deepEqual(await snapshot(), before, 'Rejected decorations mutate no preferences or messages.');
  }
  assert.deepEqual(await neutral(), baseline, 'Free preferences change no money, stats, inventory or ledger.');
  const av = await join(a), bv = await join(b); await join(machine);
  const boardA = await social(a), boardB = await social(b);
  let nearby = await get(a, boardA.chat.readPath); assert.equal(nearby.statusCode, 200, nearby.body); privateHeaders(nearby);
  assert.equal(validateNearby(nearby.json()), true, JSON.stringify(validateNearby.errors));
  assert(nearby.json().participants.some(person => person.id === b.id));
  assert.equal((await get(b, boardB.chat.readPath)).json().participants.find(person => person.id === a.id).outfit, 'moss', 'Only a joined actor publishes their selected free look.');
  assert.equal(nearby.json().participants.find(person => person.id === machine.id).kind, 'agent');
  assert(!nearby.json().participants.some(person => person.id === c.id || person.id === npc.id));
  assert.equal(JSON.stringify(nearby.json()).includes(a.account), false);
  assert.equal(JSON.stringify(nearby.json()).includes(b.account), false);
  const globalEvents = []; const listener = event => globalEvents.push(event); bus.on('chat', listener);
  const messageKey = id(), messageBody = { ...av, text: '<hi> "neighbor"'.repeat(30) };
  const concurrent = await Promise.all([post(a, '/v1/city/nearby-chat', messageBody, messageKey), post(a, '/v1/city/nearby-chat', messageBody, messageKey)]);
  const sent = concurrent.find(response => response.statusCode === 200);
  assert(sent, concurrent.map(response => response.body).join(' ')); assert.equal(validateSent(sent.json()), true);
  assert(concurrent.every(response => [200, 409].includes(response.statusCode)));
  assert.equal(sent.json().message.characterId, a.id); assert.equal(sent.json().message.generation, 1);
  assert.equal(sent.json().message.text.length, 240); assert(!/[<>"`]/.test(sent.json().message.text));
  const replay = await post(a, '/v1/city/nearby-chat', messageBody, messageKey);
  assert.equal(replay.body, sent.body, 'Completed chat replay preserves exact reply bytes.');
  assert.deepEqual(replay.json(), sent.json()); assert.equal(replay.headers['x-idempotent-replay'], 'true');
  assert.equal(Number((await app.pool.query("SELECT COUNT(*) n FROM chat_messages WHERE channel='nearby:docks'", [])).rows[0].n), 1);
  assert.equal((await post(a, '/v1/city/nearby-chat', { ...av, text: 'Too soon' })).statusCode, 429);
  assert.deepEqual(globalEvents, [], 'Nearby messages never broadcast on the legacy global chat bus.'); bus.off('chat', listener);
  const heard = await get(b, boardB.chat.readPath); assert.equal(heard.json().messages[0].id, sent.json().message.id);
  const globalBoard = await get(b, '/v1/chat'); assert.deepEqual(globalBoard.json().messages, [], 'Nearby storage never becomes global history.');
  assert.equal((await post(b, '/v1/phone/block/' + a.id, {})).statusCode, 200);
  assert(!(await get(b, boardB.chat.readPath)).json().messages.some(message => message.characterId === a.id));
  assert(!(await get(a, boardA.chat.readPath)).json().participants.some(person => person.id === b.id), 'A block works in both directions.');
  assert.equal((await app.inject({ method: 'DELETE', url: '/v1/phone/block/' + a.id, headers: b.headers })).statusCode, 200);
  const emote = await post(b, '/v1/city/nearby-chat', { ...bv, emoteId: 'wave' }); assert.equal(emote.statusCode, 200, emote.body);
  assert.equal(emote.json().message.kind, 'emote'); assert.equal(emote.json().message.text, 'waves');
  const twoMessages = (await get(a, boardA.chat.readPath)).json();
  assert.equal(twoMessages.messages[0].id, sent.json().message.id, 'Nearby history keeps the older real text first.');
  assert.equal(twoMessages.messages.at(-1).id, emote.json().message.id, 'The newest real emote is last for latest-bubble selection.');
  assert(twoMessages.participants.find(person => person.id === b.id).emote);
  assert.equal((await post(b, '/v1/city/nearby-chat', { ...bv, emoteId: 'reward' })).statusCode, 400);
  assert.equal((await post(b, '/v1/city/nearby-chat', { ...bv, emoteId: 'wave', text: 'speech' })).statusCode, 400);
  assert.deepEqual(await neutral(), baseline, 'Chat and emotes remain financially/statistically neutral.');
  const machineViewer = (await social(machine)).viewer;
  const distinct = await Promise.all([post(machine, '/v1/city/nearby-chat', { ...machineViewer, text: 'First window' }),
    post(machine, '/v1/city/nearby-chat', { ...machineViewer, text: 'Competing window' })]);
  assert.deepEqual(distinct.map(response => response.statusCode).sort(), [200, 429], 'Distinct concurrent sends serialize their real account flood window.');
  assert.deepEqual(await neutral(), baseline);
  // The existing storage admits no forged envelope fields and serves a genuinely bounded history.
  const realEnvelope = (await app.pool.query('SELECT body FROM chat_messages WHERE id=$1', [emote.json().message.id])).rows[0].body;
  for (let index = 0; index < 60; index++) await app.pool.query(
    'INSERT INTO chat_messages(id,channel,character_id,name,body,at) VALUES($1,$2,$3,$4,$5,$6)',
    ['history-bound-' + index, 'nearby:docks', b.id, b.name, realEnvelope, new Date(Date.now() - 30000 - index)]);
  assert.equal((await get(a, boardA.chat.readPath)).json().messages.length, 50);
  await app.pool.query('INSERT INTO chat_messages(id,channel,character_id,name,body) VALUES($1,$2,$3,$4,$5)',
    ['invalid-envelope', 'nearby:docks', b.id, b.name, JSON.stringify({ version: 1, generation: 1, kind: 'text', text: 'forged', accountId: b.account })]);
  assert(!(await get(a, boardA.chat.readPath)).json().messages.some(message => message.id === 'invalid-envelope'));
  if (postgres) {
    await pause();
    const beforeSend = await snapshot();
    let interrupted = false;
    const faultyPool = { async connect() {
      const client = await app.pool.connect();
      return new Proxy(client, { get(target, property) {
        if (property === 'query') return async (sql, params) => {
          if (!interrupted && /^UPDATE city_social_preferences SET/i.test(String(sql))) {
            interrupted = true; throw new Error('injected late social send interruption');
          }
          return target.query(sql, params);
        };
        const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
      } });
    } };
    await assert.rejects(sendNearbyCityChat(faultyPool, b.account, { ...bv, text: 'Must roll back' }), /injected late social send interruption/);
    assert(interrupted, 'The fault happens after the actual message insertion, before consent-row commit.');
    assert.deepEqual(await snapshot(), beforeSend, 'Native late send rollback restores exact room preference and message rows.');
  }
  for (const entry of [
    { url: '/v1/city/social/preferences', payload: { ...machineViewer, outfit: 'wine' }, type: validateUpdated },
    { url: '/v1/city/nearby-chat', payload: { ...machineViewer, text: 'One recoverable line' }, type: validateSent },
  ]) {
    if (entry.url.endsWith('nearby-chat')) await pause();
    const rollbackKey = id(), beforeRollback = await snapshot();
    let interrupted = false;
    const failed = await interceptedQueries(() => post(machine, entry.url, entry.payload, rollbackKey), async (sql, _params, run) => {
      if (!interrupted && /^UPDATE idempotency SET status=\$3/i.test(String(sql))) {
        interrupted = true; throw new Error('injected City social receipt interruption');
      }
      return run();
    });
    assert(interrupted, 'The actual handler reaches receipt finalization after its preference/chat write.');
    assert.equal(failed.statusCode, 503, failed.body); privateHeaders(failed);
    assert.deepEqual(await snapshot(), beforeRollback, 'Interrupted receipt completion rolls back the entire social effect.');
    assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM idempotency WHERE account_id=$1 AND key=$2', [machine.account, rollbackKey])).rows[0].n), 0,
      'The failed transaction leaves no successful or stranded reservation.');
    const recoveredRollback = await post(machine, entry.url, entry.payload, rollbackKey);
    assert.equal(recoveredRollback.statusCode, 200, recoveredRollback.body); assert.equal(entry.type(recoveredRollback.json()), true);
    const afterRollbackRetry = await snapshot();
    const rollbackReplay = await post(machine, entry.url, entry.payload, rollbackKey);
    assert.equal(rollbackReplay.body, recoveredRollback.body);
    assert.deepEqual(rollbackReplay.json(), recoveredRollback.json()); assert.equal(rollbackReplay.headers['x-idempotent-replay'], 'true');
    assert.deepEqual(await snapshot(), afterRollbackRetry, 'Exact rollback retry commits once, then replays without another effect.');

    if (entry.url.endsWith('nearby-chat')) await pause();
    const missingKey = id(), beforeMissing = await snapshot();
    let removed = false;
    const missing = await interceptedQueries(() => post(machine, entry.url, entry.payload, missingKey), async (sql, _params, run) => {
      if (!removed && /^UPDATE idempotency SET status=\$3/i.test(String(sql))) {
        removed = true;
        await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2', [machine.account, missingKey]);
      }
      return run();
    });
    assert(removed); assert.equal(missing.statusCode, 409, missing.body);
    assert.deepEqual(await snapshot(), beforeMissing, 'A real missing reservation/zero-row finalizer fails closed and rolls back effects.');

    const ackKey = id(), beforeAck = await snapshot();
    let lost = false;
    const uncertain = await interceptedQueries(() => post(machine, entry.url, entry.payload, ackKey), async (sql, _params, run) => {
      const result = await run();
      if (!lost && String(sql).trim() === 'COMMIT') {
        lost = true; throw new Error('injected lost City social COMMIT acknowledgement');
      }
      return result;
    });
    assert(lost, 'The actual COMMIT executes before its acknowledgement is lost.');
    assert.equal(uncertain.statusCode, 503, uncertain.body); privateHeaders(uncertain);
    const durable = (await app.pool.query('SELECT status,response FROM idempotency WHERE account_id=$1 AND key=$2', [machine.account, ackKey])).rows[0];
    assert.equal(durable?.status, 200, 'Effect and successful HTTP reply survive in one committed transaction.');
    const afterAck = await snapshot();
    if (entry.url.endsWith('nearby-chat')) assert.equal(afterAck.messages.length, beforeAck.messages.length + 1);
    const recoveredAck = await post(machine, entry.url, entry.payload, ackKey);
    assert.equal(recoveredAck.statusCode, 200, recoveredAck.body); assert.equal(entry.type(recoveredAck.json()), true);
    assert.equal(recoveredAck.body, durable.response, 'ACK-loss recovery returns the exact durably committed reply bytes.');
    assert.deepEqual(recoveredAck.json(), JSON.parse(durable.response)); assert.equal(recoveredAck.headers['x-idempotent-replay'], 'true'); privateHeaders(recoveredAck);
    assert.deepEqual(await snapshot(), afterAck, 'Immediate same-key ACK-loss recovery bypasses flood brakes and never repeats speech or preferences.');
    const changed = { ...entry.payload, ...(entry.url.endsWith('nearby-chat') ? { text: 'Changed recovery line' } : { outfit: 'ink' }) };
    assert.equal((await post(machine, entry.url, changed, ackKey)).statusCode, 422);
    assert.deepEqual(await snapshot(), afterAck, 'The durable key remains body-bound after an ambiguous acknowledgement.');
  }
  assert.deepEqual(await neutral(), baseline, 'Receipt completion and all failure/recovery cases have no economy or equipment effect.');
  await app.pool.query("UPDATE characters SET loc='foundry' WHERE id=$1", [a.id]);
  assert.equal((await get(a, boardA.chat.readPath)).statusCode, 409, 'A stale read cannot keep the previous district feed.');
  assert.equal((await post(a, '/v1/city/nearby-chat', { ...av, text: 'Old room' })).statusCode, 409);
  const foundry = await social(a); assert.equal(foundry.preferences.chatEnabled, false); assert.equal(foundry.preferences.outfit, 'moss');
  assert.equal((await get(a, foundry.chat.readPath)).statusCode, 403);
  await join(a);
  assert.deepEqual((await get(a, (await social(a)).chat.readPath)).json().messages, [], 'Different districts never share history.');
  await app.pool.query('UPDATE characters SET generation=2 WHERE id=$1', [a.id]);
  const successor = await social(a);
  assert.deepEqual(successor.preferences, { outfit: 'classic', chatEnabled: false, room: { furniture: [] } });
  assert.equal((await post(a, '/v1/city/social/preferences', { ...av, chatEnabled: true })).statusCode, 409);
  await join(a);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM city_social_preferences WHERE character_id=$1', [a.id])).rows[0].n), 2,
    'The real lifecycle proof carries two distinct owner-generation preference rows.');
  // Actual estate cleanup affects all generations of its owner, never other participants.
  const otherPrefs = (await app.pool.query('SELECT * FROM city_social_preferences WHERE character_id<>$1 ORDER BY character_id,generation', [a.id])).rows;
  if (postgres) {
    const beforeEstate = await snapshot();
    await assert.rejects(withTwoCharacters(app.pool, b.account, a.id, async (_killer, victim, client, h) => {
      await runEstate(client, h, victim, 'Social rollback proof');
      throw new Error('injected late social estate interruption');
    }, { meet: false }), /injected late social estate interruption/);
    assert.deepEqual(await snapshot(), beforeEstate, 'Native late estate failure restores exact preferences and history.');
  }
  await withTwoCharacters(app.pool, b.account, a.id, async (_killer, victim, client, h) => runEstate(client, h, victim, 'Social estate proof'), { meet: false });
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM city_social_preferences WHERE character_id=$1', [a.id])).rows[0].n), 0);
  assert.deepEqual((await app.pool.query('SELECT * FROM city_social_preferences WHERE character_id<>$1 ORDER BY character_id,generation', [a.id])).rows, otherPrefs);
  const child = await social(a); assert.equal(child.preferences.chatEnabled, false); assert.equal(child.preferences.outfit, 'classic');
  await app.pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [c.account]);
  assert.equal((await get(c, '/v1/city/social')).statusCode, 401, 'Revoked tokens cannot inspect private preferences.');
  await app.pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [machine.account]);
  assert.equal((await get(machine, '/v1/city/social')).statusCode, 403);
  const openapi = (await app.inject({ url: '/openapi.json' })).json();
  for (const route of ['/v1/city/social', '/v1/city/social/preferences', '/v1/city/nearby-chat']) assert(openapi.paths[route]);
  assert.equal(openapi.paths['/v1/city/nearby-chat'].post.requestBody.content['application/json'].schema.additionalProperties, false);
  console.log('city-social-api PASS: real owner/default-off consent, closed free cosmetics/room, private current-district reads, real sender/emote snapshots, blocks, rate, concurrent HTTP replay, no global broadcast, neutral effects, travel/generation/auth/estate cleanup' +
    (postgres ? ', native owner locks, atomic HTTP receipts, actual COMMIT ACK-loss recovery and late estate rollback' : ' (pg-mem; native locking/atomic commit/estate rollback not claimed)'));
} finally {
  await app.close();
  if (basePool) { assert(/^[a-z_0-9]+$/.test(namespace)); await basePool.query(`DROP SCHEMA ${namespace} CASCADE`); await basePool.end(); }
}
