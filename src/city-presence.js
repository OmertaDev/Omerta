// Public district snapshots and private, nonfinancial encounter progression.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { DISTRICTS, levelOf } from './rules.js';
import { withItemRead, withItemTransaction, withItemMutation, registerItemTransactionUndo } from './items.js';

export const CITY_JOURNAL_LIMIT = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPS = Object.freeze([
  ['public-whereabouts', 'Know your neighborhood', 'The fixer, workshop, training room and newsroom each offer a different way to get ahead. Look for their signs around the neighborhood.'],
  ['issued-actions', 'Find a fresh face', 'Your next lead opens when you meet someone new. Check the journal to see whose perspective you still need.'],
  ['shared-gym', 'Training takes patience', 'Muscle, cunning and speed share a recovery clock. Train one, then check back before your next session.'],
  ['workshop-door', 'Useful connections', 'Visit the workshop for the garage, market and fieldwork. A new lead can take you beyond street jobs.'],
  ['newsroom-leads', 'Follow the evidence', 'The newsroom investigation advances through choices and gathered evidence. Check your journal for the next lead.'],
  ['same-key', 'Every angle counts', 'Collect intel from NPCs, agents and players. Compare all three perspectives to finish your neighborhood survey.'],
]);
const OBJECTIVES = Object.freeze([
  ['meet-new-face', 'Meet a different face', 'Record a later public encounter with someone other than your first source.'],
  ['cross-check', 'Cross-check another perspective', 'After meeting another face, record a later encounter with a different kind of actor than your first source.'],
  ['three-perspectives', 'Bring three perspectives together', 'After cross-checking, record a later encounter with the remaining actor kind and a different source.'],
]);
const fail = (code, message) => { throw new GameError(code, message); };
const districtName = id => DISTRICTS.find(d => d.id === id)?.name || id;
const viewerOf = row => ({ characterId: row.id, generation: Number(row.generation), district: row.loc });
const kindOf = row => row.is_npc ? 'npc' : row.agent_flag ? 'agent' : 'player';
const actorOf = (row, online) => ({ id: row.id, name: row.name, generation: Number(row.generation),
  kind: kindOf(row), district: row.loc, level: levelOf(Number(row.respect)), gangTag: row.tag || null,
  ...(online ? { online: online.has(row.account_id) } : {}) });
const parseJson = value => typeof value === 'string' ? JSON.parse(value) : value;
const clone = value => JSON.parse(JSON.stringify(value));

async function currentActor(client, accountId) {
  const row = (await client.query(`SELECT id,account_id,name,generation,loc,alive FROM characters
    WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`, [accountId])).rows[0];
  if (!row) fail('no_character', 'Create a living character first.');
  return row;
}
function identityMatches(row, body, accountId) {
  return row && row.alive && row.account_id === accountId && row.id === body.characterId
    && Number(row.generation) === body.generation && row.loc === body.district;
}
export function validateEncounterBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).sort().join(',') !== 'characterId,district,generation,targetGeneration'
    || typeof body.characterId !== 'string' || body.characterId.length < 1 || body.characterId.length > 200
    || !Number.isSafeInteger(body.generation) || body.generation < 1
    || !Number.isSafeInteger(body.targetGeneration) || body.targetGeneration < 1
    || typeof body.district !== 'string' || !DISTRICTS.some(d => d.id === body.district)) {
    fail('bad_city_encounter', 'Use the current issued encounter action.');
  }
}
function receiptKey(accountId, key) {
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('idempotency_required', 'Supply an Idempotency-Key.');
  return 'city:intel:v1:' + crypto.createHash('sha256').update(JSON.stringify([accountId, key])).digest('hex');
}
async function progressRow(client, viewer, lock = false) {
  const result = lock
    ? await client.query('SELECT sequence,journal,objectives FROM city_intel_progress WHERE character_id=$1 AND generation=$2 FOR UPDATE',
      [viewer.characterId, viewer.generation])
    : await client.query('SELECT sequence,journal,objectives FROM city_intel_progress WHERE character_id=$1 AND generation=$2',
      [viewer.characterId, viewer.generation]);
  return result.rows[0] || null;
}
function projectBoard(viewer, row) {
  const state = row ? clone(parseJson(row.objectives)) : {};
  const journal = row ? clone(parseJson(row.journal)) : [];
  const visible = state.firstSourceId ? state.crossSequence ? 3 : state.distinctSequence ? 2 : 1 : 0;
  const completed = [state.distinctSequence, state.crossSequence, state.thirdSequence];
  return { viewer, journal,
    objectives: OBJECTIVES.slice(0, visible).map(([id, title, description], i) => ({ id, title, description,
      venueId: 'stories', status: completed[i] ? 'completed' : 'available', available: !completed[i], actions: [] })),
    progress: { collected: journal.length, totalEncounters: row ? Number(row.sequence) : 0,
      completedObjectives: completed.filter(Boolean).length, totalObjectives: 3, journalLimit: CITY_JOURNAL_LIMIT } };
}
export async function cityIntel(pool, accountId) {
  return withItemRead(pool, async client => {
    const viewer = viewerOf(await currentActor(client, accountId));
    return projectBoard(viewer, await progressRow(client, viewer));
  });
}

export async function cityPresence(pool, accountId, onlineIds = [], query = {}) {
  if (Object.keys(query).some(k => !['cursor', 'limit'].includes(k))) fail('bad_city_presence', 'Unknown presence filter.');
  const limit = query.limit === undefined ? 24 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) fail('bad_city_presence', 'Presence limit must be between 1 and 40.');
  return withItemRead(pool, async client => {
    const viewer = viewerOf(await currentActor(client, accountId));
    let after = '';
    if (query.cursor !== undefined) {
      if (typeof query.cursor !== 'string' || query.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) fail('bad_city_presence', 'Invalid presence cursor.');
      let cursor;
      try { cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')); } catch { fail('bad_city_presence', 'Invalid presence cursor.'); }
      if (!cursor || Object.keys(cursor).sort().join(',') !== 'after,characterId,district,generation'
        || typeof cursor.after !== 'string' || !UUID.test(cursor.after)) fail('bad_city_presence', 'Invalid presence cursor.');
      if (cursor.characterId !== viewer.characterId || cursor.generation !== viewer.generation || cursor.district !== viewer.district) fail('city_cursor_stale', 'Your neighborhood changed. Refresh the roster.');
      after = cursor.after;
    }
    const rows = after ? (await client.query(`SELECT c.id,c.account_id,c.name,c.generation,c.loc,c.respect,c.is_npc,a.agent_flag,g.tag
      FROM characters c LEFT JOIN account_persistent a ON a.account_id=c.account_id
      LEFT JOIN gang_members m ON m.character_id=c.id LEFT JOIN gangs g ON g.id=m.gang_id
      WHERE c.alive AND c.loc=$1 AND c.account_id<>$2 AND c.id>$3 ORDER BY c.id LIMIT $4`,
      [viewer.district, accountId, after, limit + 1])).rows
      : (await client.query(`SELECT c.id,c.account_id,c.name,c.generation,c.loc,c.respect,c.is_npc,a.agent_flag,g.tag
      FROM characters c LEFT JOIN account_persistent a ON a.account_id=c.account_id
      LEFT JOIN gang_members m ON m.character_id=c.id LEFT JOIN gangs g ON g.id=m.gang_id
      WHERE c.alive AND c.loc=$1 AND c.account_id<>$2 ORDER BY c.id LIMIT $3`,
        [viewer.district, accountId, limit + 1])).rows;
    const online = new Set(onlineIds), more = rows.length > limit;
    const actors = rows.slice(0, limit).map(row => ({ ...actorOf(row, online), actions: [{
      id: 'encounter:' + row.id, label: 'Collect intel', method: 'POST',
      path: '/v1/city/encounters/' + encodeURIComponent(row.id),
      body: { ...viewer, targetGeneration: Number(row.generation) }, available: true, blockedBy: [], consequence: '',
    }] }));
    return { viewer, district: { id: viewer.district, name: districtName(viewer.district) }, actors,
      nextCursor: more ? Buffer.from(JSON.stringify({ ...viewer, after: actors.at(-1).id })).toString('base64url') : null,
      hasMore: more, placement: 'approximate_district', generatedAt: new Date().toISOString() };
  });
}

export async function recordCityEncounter(pool, accountId, actorId, body, key) {
  validateEncounterBody(body);
  if (!UUID.test(actorId)) fail('city_actor_unavailable', 'That public encounter is unavailable.');
  return withItemTransaction(pool, async client => {
    // Authority comes from the authenticated account's server-selected living street. The body
    // carries only freshness preconditions; it cannot nominate a historical or different owner.
    const owner = await currentActor(client, accountId);
    if (!identityMatches(owner, body, accountId)) fail('city_identity_changed', 'Your character changed. Refresh the neighborhood.');
    return withItemMutation(client, { scope: 'character', id: owner.id }, 'world_action', receiptKey(accountId, key),
      { action: 'city_encounter', actorId, ...body }, async () => {
        // The item replay guard locks no character. Acquire both characters in one sorted order.
        const rows = (await client.query(`SELECT id,account_id,name,generation,loc,respect,is_npc,alive
          FROM characters WHERE id IN ($1,$2) ORDER BY id FOR UPDATE`, [owner.id, actorId])).rows;
        const me = rows.find(r => r.id === owner.id), target = rows.find(r => r.id === actorId);
        if (!identityMatches(me, body, accountId)) fail('city_identity_changed', 'Your character changed. Refresh the neighborhood.');
        const current = await currentActor(client, accountId);
        if (current.id !== me.id || Number(current.generation) !== body.generation) fail('city_identity_changed', 'Your character changed. Refresh the neighborhood.');
        if (!target || !target.alive || target.account_id === accountId || target.loc !== me.loc
          || Number(target.generation) !== body.targetGeneration) fail('city_actor_unavailable', 'That public encounter is unavailable.');
        const flag = (await client.query('SELECT agent_flag FROM account_persistent WHERE account_id=$1', [target.account_id])).rows[0];
        const gang = (await client.query('SELECT g.tag FROM gang_members m JOIN gangs g ON g.id=m.gang_id WHERE m.character_id=$1', [target.id])).rows[0];
        const source = actorOf({ ...target, agent_flag: flag?.agent_flag, tag: gang?.tag });
        const viewer = viewerOf(me), prior = await progressRow(client, viewer, true);
        const sequence = prior ? Number(prior.sequence) + 1 : 1;
        if (!Number.isSafeInteger(sequence)) fail('city_intel_limit', 'This journal has reached its supported limit.');
        const state = prior ? clone(parseJson(prior.objectives)) : {};
        if (!state.firstSourceId) { state.firstSourceId = source.id; state.firstKind = source.kind; }
        else if (!state.distinctSequence && source.id !== state.firstSourceId) state.distinctSequence = sequence;
        else if (state.distinctSequence && !state.crossSequence && source.id !== state.firstSourceId && source.kind !== state.firstKind) {
          state.crossSequence = sequence; state.crossSourceId = source.id; state.crossKind = source.kind;
        } else if (state.crossSequence && !state.thirdSequence && source.id !== state.firstSourceId
          && source.id !== state.crossSourceId && ![state.firstKind, state.crossKind].includes(source.kind)) state.thirdSequence = sequence;
        const [tipId, title, description] = TIPS[(sequence - 1) % TIPS.length];
        const intel = { id: 'city-intel:' + sequence, sequence, kind: source.kind, title, description,
          tipId, source, collectedAt: new Date().toISOString() };
        const journal = [intel, ...(prior ? clone(parseJson(prior.journal)) : [])].slice(0, CITY_JOURNAL_LIMIT);
        registerItemTransactionUndo(client, () => prior
          ? client.query('UPDATE city_intel_progress SET sequence=$3,journal=$4,objectives=$5 WHERE character_id=$1 AND generation=$2',
            [viewer.characterId, viewer.generation, prior.sequence, JSON.stringify(parseJson(prior.journal)), JSON.stringify(parseJson(prior.objectives))])
          : client.query('DELETE FROM city_intel_progress WHERE character_id=$1 AND generation=$2', [viewer.characterId, viewer.generation]));
        await client.query(`INSERT INTO city_intel_progress(character_id,generation,sequence,journal,objectives)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT(character_id,generation) DO UPDATE
          SET sequence=EXCLUDED.sequence,journal=EXCLUDED.journal,objectives=EXCLUDED.objectives`,
        [viewer.characterId, viewer.generation, sequence, JSON.stringify(journal), JSON.stringify(state)]);
        return { ok: true, encounteredActor: source, intel,
          ...projectBoard(viewer, { sequence, journal, objectives: state }) };
      });
  });
}
