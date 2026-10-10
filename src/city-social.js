// Free, private cosmetic preferences and explicitly joined district chat. No economy effects.
import crypto from 'node:crypto';
import { GameError, cleanText } from './game.js';
import { withItemRead, withItemTransaction, registerItemTransactionUndo } from './items.js';
import { finalizeHttpIdempotency } from './http-idempotency.js';
import { CITY_OUTFITS, CITY_EMOTES, CITY_FURNITURE } from './city-social-contract.js';
export { CITY_OUTFITS, CITY_EMOTES, CITY_FURNITURE } from './city-social-contract.js';
const EMOTE_TTL_MS = 10000;
const ENVELOPE_VERSION = 1;
const MAX_TEXT = 240;
const MAX_LAYOUT = 12;
const CHAT_BRAKE_MS = 2000;
const fail = (code, message) => { throw new GameError(code, message); };
const clone = value => JSON.parse(JSON.stringify(value));
const viewerOf = actor => ({ characterId: actor.id, generation: Number(actor.generation), district: actor.loc });
const keysOnly = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => allowed.includes(key));
const identifier = value => typeof value === 'string' && /^[!-~]{1,200}$/.test(value);
const validGeneration = value => Number.isSafeInteger(value) && value >= 1;

export function validateCityViewer(body) {
  if (!body || !identifier(body.characterId) || !validGeneration(body.generation) || !identifier(body.district)) {
    fail('bad_city_social', 'Use the current neighborhood action.');
  }
}
export function validateCityRoom(room) {
  if (!keysOnly(room, ['furniture']) || !Array.isArray(room.furniture) || room.furniture.length > MAX_LAYOUT) {
    fail('bad_city_room', 'Choose up to twelve decorations for the six-by-six room.');
  }
  const occupied = new Set();
  return { furniture: room.furniture.map(entry => {
    if (!keysOnly(entry, ['id', 'x', 'y', 'rotation']) || !CITY_FURNITURE.some(item => item.id === entry.id)
      || !Number.isInteger(entry.x) || entry.x < 0 || entry.x > 5
      || !Number.isInteger(entry.y) || entry.y < 0 || entry.y > 5
      || (entry.rotation !== undefined && (!Number.isInteger(entry.rotation) || entry.rotation < 0 || entry.rotation > 3))) {
      fail('bad_city_room', 'Use catalog decorations and valid room positions.');
    }
    const cell = entry.x + ':' + entry.y;
    if (occupied.has(cell)) fail('bad_city_room', 'Place each decoration in a different square.');
    occupied.add(cell);
    return { id: entry.id, x: entry.x, y: entry.y, rotation: entry.rotation ?? 0 };
  }) };
}
export function validateCityPreferences(body) {
  if (!keysOnly(body, ['characterId', 'generation', 'district', 'outfit', 'chatEnabled', 'room'])
    || !['outfit', 'chatEnabled', 'room'].some(key => Object.hasOwn(body, key))) {
    fail('bad_city_social', 'Choose a supported neighborhood preference.');
  }
  validateCityViewer(body);
  if (body.outfit !== undefined && !CITY_OUTFITS.some(outfit => outfit.id === body.outfit)) fail('bad_city_outfit', 'Choose a free catalog outfit.');
  if (body.chatEnabled !== undefined && typeof body.chatEnabled !== 'boolean') fail('bad_city_social', 'Chat consent must be explicit.');
  if (body.room !== undefined) validateCityRoom(body.room);
}
export function validateCityChat(body) {
  if (!keysOnly(body, ['characterId', 'generation', 'district', 'text', 'emoteId'])
    || Number(Object.hasOwn(body, 'text')) + Number(Object.hasOwn(body, 'emoteId')) !== 1) {
    fail('bad_city_chat', 'Send a message or choose one emote.');
  }
  validateCityViewer(body);
  if (Object.hasOwn(body, 'text') && (typeof body.text !== 'string' || body.text.length > 2000 || !cleanText(body.text).trim())) fail('empty', 'Say something within the message limit.');
  if (Object.hasOwn(body, 'emoteId') && !CITY_EMOTES.some(emote => emote.id === body.emoteId)) fail('bad_city_emote', 'Choose a catalog emote.');
}

async function currentActor(client, accountId, lock = false) {
  const actor = (await (lock
    ? client.query('SELECT id,name,generation,loc,is_npc FROM characters WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1 FOR UPDATE', [accountId])
    : client.query('SELECT id,name,generation,loc,is_npc FROM characters WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1', [accountId]))).rows[0];
  if (!actor) fail('no_character', 'Create a living character first.');
  const flags = (await client.query('SELECT agent_flag,npc_flag FROM account_persistent WHERE account_id=$1', [accountId])).rows[0];
  if (actor.is_npc || flags?.npc_flag) fail('city_social_unavailable', 'This neighborhood action is unavailable.');
  return { ...actor, kind: flags?.agent_flag ? 'agent' : 'player' };
}
function assertCurrent(actor, supplied) {
  if (actor.id !== supplied.characterId || Number(actor.generation) !== supplied.generation || actor.loc !== supplied.district) {
    fail('city_social_identity_changed', 'Your neighborhood changed. Refresh before continuing.');
  }
}
async function preferenceRow(client, actor, lock = false) {
  const params = [actor.id, Number(actor.generation)];
  return (await (lock
    ? client.query('SELECT outfit,chat_enabled,chat_district,room_layout,last_chat_at FROM city_social_preferences WHERE character_id=$1 AND generation=$2 FOR UPDATE', params)
    : client.query('SELECT outfit,chat_enabled,chat_district,room_layout,last_chat_at FROM city_social_preferences WHERE character_id=$1 AND generation=$2', params))).rows[0] || null;
}
function preferenceState(actor, row) {
  const furniture = row ? (typeof row.room_layout === 'string' ? JSON.parse(row.room_layout) : row.room_layout) : [];
  return { outfit: row?.outfit || 'classic', chatEnabled: !!row?.chat_enabled && row.chat_district === actor.loc,
    room: validateCityRoom({ furniture }) };
}
async function savePreferenceRow(client, actor, previous, next) {
  registerItemTransactionUndo(client, async () => {
    if (!previous) await client.query('DELETE FROM city_social_preferences WHERE character_id=$1 AND generation=$2', [actor.id, Number(actor.generation)]);
    else await client.query(`UPDATE city_social_preferences SET outfit=$3,chat_enabled=$4,chat_district=$5,room_layout=$6,last_chat_at=$7
      WHERE character_id=$1 AND generation=$2`, [actor.id, Number(actor.generation), previous.outfit,
      previous.chat_enabled, previous.chat_district, JSON.stringify(previous.room_layout), previous.last_chat_at]);
  });
  if (previous) await client.query(`UPDATE city_social_preferences SET outfit=$3,chat_enabled=$4,chat_district=$5,room_layout=$6,last_chat_at=$7
    WHERE character_id=$1 AND generation=$2`, [actor.id, Number(actor.generation), next.outfit, next.chat_enabled,
    next.chat_district, JSON.stringify(next.room_layout), next.last_chat_at]);
  else await client.query(`INSERT INTO city_social_preferences(character_id,generation,outfit,chat_enabled,chat_district,room_layout,last_chat_at)
    VALUES($1,$2,$3,$4,$5,$6,$7)`, [actor.id, Number(actor.generation), next.outfit, next.chat_enabled,
    next.chat_district, JSON.stringify(next.room_layout), next.last_chat_at]);
}
async function completeCityReceipt(client, receipt, result) {
  if (!receipt) return; // Trusted non-HTTP callers can compose the transaction without an HTTP reservation.
  const response = JSON.stringify(result);
  registerItemTransactionUndo(client, () => client.query(`UPDATE idempotency SET status=0,response=$4
    WHERE account_id=$1 AND key=$2 AND body_hash=$3 AND status=200 AND response=$5`,
  [receipt.accountId, receipt.key, receipt.bodyHash, receipt.reservationToken, response]));
  const completed = await finalizeHttpIdempotency(client, receipt, { status: 200, response });
  if (completed.rowCount !== 1) fail('contention', 'The neighborhood request must be retried.');
}
const readPath = viewer => '/v1/city/nearby-chat?' + new URLSearchParams(Object.entries(viewer).map(([key, value]) => [key, String(value)]));
const action = (id, label, path, body, blockedBy = [], inputFields = []) => ({ id, label, method: 'POST', path, body,
  available: blockedBy.length === 0, blockedBy, ...(inputFields.length ? { inputFields } : {}) });

export async function citySocialBoard(pool, accountId) {
  return withItemRead(pool, async client => {
    const actor = await currentActor(client, accountId), viewer = viewerOf(actor);
    const preferences = preferenceState(actor, await preferenceRow(client, actor));
    const blockedBy = preferences.chatEnabled ? [] : [{ code: 'city_chat_opt_in_required' }];
    return { viewer, preferences, outfits: clone(CITY_OUTFITS), emotes: CITY_EMOTES.map(({ id, name }) => ({ id, name })),
      furniture: clone(CITY_FURNITURE), roomSize: { width: 6, height: 6 },
      chat: { readPath: readPath(viewer), available: preferences.chatEnabled, blockedBy },
      actions: [
        ...CITY_OUTFITS.map(outfit => action('outfit:' + outfit.id, 'Wear ' + outfit.name, '/v1/city/social/preferences', { ...viewer, outfit: outfit.id })),
        action('chat:enable', 'Join nearby chat', '/v1/city/social/preferences', { ...viewer, chatEnabled: true }),
        action('chat:disable', 'Leave nearby chat', '/v1/city/social/preferences', { ...viewer, chatEnabled: false }),
        action('room:save', 'Save room decorations', '/v1/city/social/preferences', { ...viewer, room: preferences.room }, [], ['room']),
        action('chat:send', 'Send nearby message', '/v1/city/nearby-chat', viewer, blockedBy, ['text']),
        ...CITY_EMOTES.map(emote => action('emote:' + emote.id, emote.name, '/v1/city/nearby-chat', { ...viewer, emoteId: emote.id }, blockedBy)),
      ] };
  });
}
export async function updateCityPreferences(pool, accountId, body, receipt) {
  validateCityPreferences(body);
  return withItemTransaction(pool, async client => {
    const actor = await currentActor(client, accountId, true); assertCurrent(actor, body);
    const previous = await preferenceRow(client, actor, true);
    const layout = body.room === undefined ? preferenceState(actor, previous).room : validateCityRoom(body.room);
    const next = { outfit: body.outfit ?? previous?.outfit ?? 'classic', chat_enabled: body.chatEnabled ?? previous?.chat_enabled ?? false,
      chat_district: body.chatEnabled === true ? actor.loc : body.chatEnabled === false ? null : previous?.chat_district || null,
      room_layout: layout.furniture, last_chat_at: previous?.last_chat_at || null };
    await savePreferenceRow(client, actor, previous, next);
    const result = { ok: true, social: 'updated', message: 'Neighborhood preferences saved.', viewer: viewerOf(actor), preferences: preferenceState(actor, next) };
    await completeCityReceipt(client, receipt, result);
    return result;
  });
}
function decodeMessage(row) {
  if (typeof row.body !== 'string' || Buffer.byteLength(row.body, 'utf8') > 2048) return null;
  let data;
  try { data = JSON.parse(row.body); } catch { return null; }
  if (!keysOnly(data, ['version', 'generation', 'kind', 'text', 'emoteId']) || data.version !== ENVELOPE_VERSION
    || !validGeneration(data.generation) || !['text', 'emote'].includes(data.kind)
    || typeof data.text !== 'string' || data.text.length > MAX_TEXT || !data.text || cleanText(data.text) !== data.text
    || (data.kind === 'text' && data.emoteId !== undefined)
    || (data.kind === 'emote' && !CITY_EMOTES.some(emote => emote.id === data.emoteId && emote.text === data.text))) return null;
  return { id: row.id, characterId: row.character_id, generation: data.generation, who: row.name,
    kind: data.kind, text: data.text, ...(data.kind === 'emote' ? { emoteId: data.emoteId } : {}), at: new Date(row.at).toISOString() };
}
async function blockedAccounts(client, accountId) {
  return new Set((await client.query('SELECT blocker_account,blocked_account FROM dm_blocks WHERE blocker_account=$1 OR blocked_account=$1', [accountId]))
    .rows.map(row => row.blocker_account === accountId ? row.blocked_account : row.blocker_account));
}
export async function nearbyCityChat(pool, accountId, viewer, onlineIds = []) {
  validateCityViewer(viewer);
  return withItemRead(pool, async client => {
    const actor = await currentActor(client, accountId); assertCurrent(actor, viewer);
    if (!preferenceState(actor, await preferenceRow(client, actor)).chatEnabled) fail('city_chat_opt_in_required', 'Join nearby chat before reading it.');
    const blocked = await blockedAccounts(client, accountId);
    const rows = (await client.query(`SELECT m.id,m.character_id,m.name,m.body,m.at,c.account_id,a.status
      FROM chat_messages m JOIN characters c ON c.id=m.character_id JOIN accounts a ON a.id=c.account_id
      WHERE m.channel=$1 ORDER BY m.at DESC,m.id DESC LIMIT 50`, ['nearby:' + actor.loc])).rows;
    const messages = rows.filter(row => !blocked.has(row.account_id) && row.status !== 'banned').map(decodeMessage).filter(Boolean).reverse();
    const people = (await client.query(`SELECT c.id,c.name,c.generation,c.is_npc,c.account_id,p.outfit,ap.agent_flag,ap.npc_flag
      FROM characters c JOIN city_social_preferences p ON p.character_id=c.id AND p.generation=c.generation
      JOIN accounts a ON a.id=c.account_id LEFT JOIN account_persistent ap ON ap.account_id=c.account_id
      WHERE c.alive AND c.loc=$1 AND p.chat_enabled AND p.chat_district=$1 AND a.status<>'banned'
      ORDER BY c.id LIMIT 40`, [actor.loc])).rows;
    const online = new Set(onlineIds), now = Date.now();
    const participants = people.filter(person => !person.is_npc && !person.npc_flag && !blocked.has(person.account_id)).map(person => {
      const emote = [...messages].reverse().find(message => message.characterId === person.id
        && message.generation === Number(person.generation) && message.kind === 'emote'
        && now >= Date.parse(message.at) && now - Date.parse(message.at) < EMOTE_TTL_MS);
      return { id: person.id, generation: Number(person.generation), name: person.name,
        kind: person.agent_flag ? 'agent' : 'player', outfit: person.outfit, online: online.has(person.account_id),
        ...(emote ? { emote: { id: emote.emoteId, at: emote.at } } : {}) };
    });
    return { viewer: viewerOf(actor), messages, participants, placement: 'approximate_district' };
  });
}
export async function sendNearbyCityChat(pool, accountId, body, { lastChatAt, capMap = () => {}, receipt } = {}) {
  validateCityChat(body);
  const result = await withItemTransaction(pool, async client => {
    const actor = await currentActor(client, accountId, true); assertCurrent(actor, body);
    const previous = await preferenceRow(client, actor, true);
    if (!preferenceState(actor, previous).chatEnabled) fail('city_chat_opt_in_required', 'Join nearby chat before speaking.');
    const now = Date.now(), last = Math.max(new Date(previous?.last_chat_at || 0).getTime(), lastChatAt?.get(accountId) || 0);
    if (now - last < CHAT_BRAKE_MS) fail('slow_down', 'Easy — one line at a time.');
    const emote = body.emoteId === undefined ? null : CITY_EMOTES.find(entry => entry.id === body.emoteId);
    const text = emote ? emote.text : cleanText(body.text).trim().slice(0, MAX_TEXT);
    const envelope = { version: ENVELOPE_VERSION, generation: Number(actor.generation), kind: emote ? 'emote' : 'text',
      text, ...(emote ? { emoteId: emote.id } : {}) };
    const id = crypto.randomUUID();
    registerItemTransactionUndo(client, () => client.query('DELETE FROM chat_messages WHERE id=$1', [id]));
    const row = (await client.query(`INSERT INTO chat_messages(id,channel,character_id,name,body) VALUES($1,$2,$3,$4,$5)
      RETURNING id,character_id,name,body,at`, [id, 'nearby:' + actor.loc, actor.id, actor.name, JSON.stringify(envelope)])).rows[0];
    await savePreferenceRow(client, actor, previous, { ...previous, last_chat_at: new Date(now) });
    const result = { ok: true, chat: 'sent', message: decodeMessage(row) };
    await completeCityReceipt(client, receipt, result);
    return result;
  });
  if (lastChatAt) { lastChatAt.set(accountId, Date.now()); capMap(lastChatAt); }
  return result;
}

export function registerCitySocial(app, { pool, auth, onlineIds = () => [], lastChatAt, capMap }) {
  const privateResponse = async (_req, reply) => { reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Authorization'); };
  const requireKey = async req => {
    if (typeof req.headers['idempotency-key'] !== 'string' || !/^[!-~]{1,128}$/.test(req.headers['idempotency-key'])) fail('idempotency_required', 'Supply an Idempotency-Key.');
    if (!req._idem?.reservationToken) fail('idempotency_required', 'The neighborhood request needs its reserved key.');
  };
  const receiptOf = req => ({ ...req._idem, accountId: req.user.sub });
  const safeError = (error, _req, reply) => {
    reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Authorization');
    const status = error?.statusCode === 401 ? 401 : error?.code === 'city_chat_opt_in_required' ? 403
      : ['city_social_identity_changed', 'contention'].includes(error?.code) ? 409 : error?.code === 'slow_down' ? 429
      : ['item_commit_unknown', 'item_recovery_required', 'item_integrity_error'].includes(error?.code) ? 503
      : error instanceof GameError ? 400 : 503;
    if (status === 429) reply.header('Retry-After', '2');
    return reply.code(status).send({ error: status === 401 ? 'unauthorized' : error instanceof GameError ? error.code : 'city_social_unavailable',
      message: error?.code === 'item_commit_unknown' ? 'The neighborhood result is uncertain. Retry the same request key.'
        : error instanceof GameError ? error.message : 'The neighborhood could not refresh. Try again.' });
  };
  const route = { onRequest: privateResponse, errorHandler: safeError };
  app.get('/v1/city/social', { ...route, preHandler: auth }, req => {
    if (Object.keys(req.query || {}).length) fail('bad_city_social', 'This view belongs to your current character.');
    return citySocialBoard(pool, req.user.sub);
  });
  app.post('/v1/city/social/preferences', { ...route, preHandler: [auth, requireKey] }, req => updateCityPreferences(pool, req.user.sub, req.body, receiptOf(req)));
  app.get('/v1/city/nearby-chat', { ...route, preHandler: auth }, req => {
    if (!keysOnly(req.query, ['characterId', 'generation', 'district']) || !/^[1-9][0-9]*$/.test(req.query?.generation || '')) fail('bad_city_social', 'Use the current nearby chat view.');
    return nearbyCityChat(pool, req.user.sub, { ...req.query, generation: Number(req.query.generation) }, onlineIds());
  });
  app.post('/v1/city/nearby-chat', { ...route, preHandler: [auth, requireKey] }, req => sendNearbyCityChat(pool, req.user.sub, req.body, { lastChatAt, capMap, receipt: receiptOf(req) }));
}
