import crypto from 'node:crypto';
import { dbCaps } from '../db.js';

// This is a projection of existing durable game records. Bus messages are wake-up
// hints only: notify() emits before its transaction commits, including on rollback.
const TOPICS = Object.freeze({
  'crew.request.created': { scope: 'omerta.social.read', source: 'notifications', types: ['crew_request'], coverage: 'Requests to join the current crew, visible to its current leader.' },
  'mystery.clue.discovered': { scope: 'omerta.mysteries.read', source: 'notifications', types: ['clue_found'], coverage: 'Personal clue-scroll discoveries; world-graph mysteries do not yet emit durable transition events.' },
  'player.notification': { scope: 'omerta.player.read', source: 'notifications', types: ['attack', 'attempt', 'whacked', 'busted', 'raid'], coverage: 'Personal combat and law notification signals; notification payloads remain private.' },
  'economy.notification': { scope: 'omerta.economy.read', source: 'notifications', types: ['sale', 'market_outbid', 'order_filled', 'market_sold', 'order_expired', 'market_reserve', 'market_won'], coverage: 'Personal market notification signals.' },
  'coordination.created': { scope: 'omerta.coordination.read', source: 'coordination', coverage: 'Owned coordination instances.' },
  'coordination.node.discovered': { scope: 'omerta.coordination.read', source: 'coordination', coverage: 'Owned coordination instances, with currently visible nodes only.' },
  'coordination.node.completed': { scope: 'omerta.coordination.read', source: 'coordination', coverage: 'Owned coordination instances, with currently visible nodes only.' },
  'coordination.completed': { scope: 'omerta.coordination.read', source: 'coordination', coverage: 'Owned coordination instances.' },
  'coordination.cancelled': { scope: 'omerta.coordination.read', source: 'coordination', coverage: 'Owned coordination instances.' },
  'world.event.resolved': { scope: 'omerta.world.read', source: 'world', coverage: 'Published city event results.' },
});
const UNSUPPORTED = Object.freeze([
  'family.operation.available', 'territory.attacked', 'territory.control.changed',
  'mystery.state.changed', 'crafting.requirements.met', 'mission.available',
  'operation.ready', 'trade.proposed', 'season.milestone.near',
  'world.event.started', 'player.resource.requested',
]);
const SOURCES = ['notifications', 'coordination', 'world'];
const MAX_SCAN = 100;
const MAX_SUBSCRIPTIONS = 20;
const fail = (code, statusCode = 400) => { throw Object.assign(new Error(code), { code, statusCode }); };
const iso = (value) => new Date(value).toISOString();
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const parseObject = (value) => { try { const parsed = JSON.parse(value); return object(parsed) ? parsed : {}; } catch { return {}; } };
const textId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[\w:.-]+$/.test(value);
const emptyPosition = () => ({ at: '1970-01-01T00:00:00.000Z', id: '' });
const cursorColumn = (column) => dbCaps.timestampText
  ? `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` : column;

function decodeCursor(after, identity) {
  if (!after) return Object.fromEntries(SOURCES.map((key) => [key, emptyPosition()]));
  if (typeof after !== 'string' || after.length > 3000 || !/^[\w-]+$/.test(after)) fail('invalid_event_cursor');
  let value;
  try { value = JSON.parse(Buffer.from(after, 'base64url').toString('utf8')); } catch { fail('invalid_event_cursor'); }
  if (!object(value) || value.version !== 1 || value.connection !== identity.connectionId
      || value.subscription !== identity.subscriptionId || !object(value.positions)) fail('invalid_event_cursor');
  for (const source of SOURCES) {
    const position = value.positions[source];
    if (!object(position) || typeof position.at !== 'string' || position.at.length > 40
        || !/^[\dTtZz:+. -]+$/.test(position.at) || !Number.isFinite(Date.parse(position.at))
        || typeof position.id !== 'string' || (position.id !== '' && !textId(position.id))) fail('invalid_event_cursor');
  }
  return Object.fromEntries(SOURCES.map((key) => [key, value.positions[key]]));
}
function encodeCursor(positions, identity) {
  return Buffer.from(JSON.stringify({ version: 1, connection: identity.connectionId,
    subscription: identity.subscriptionId, positions })).toString('base64url');
}
function topicList(value) {
  if (!Array.isArray(value) || !value.length || value.length > Object.keys(TOPICS).length
      || value.some((topic) => typeof topic !== 'string' || !Object.hasOwn(TOPICS, topic))) fail('unsupported_event_topic');
  return [...new Set(value)].sort();
}
function publicSubscription(row) {
  return { id: row.id, topics: JSON.parse(row.topics_json), createdAt: iso(row.created_at), active: !row.revoked_at };
}

export function createEventGateway({ pool, authorize, bus, coordination, heartbeatMs = 30_000 } = {}) {
  if (!pool || typeof authorize !== 'function') throw new TypeError('Event gateway requires a pool and fresh authorization');
  if (!Number.isInteger(heartbeatMs) || heartbeatMs < 1000) throw new TypeError('Invalid event heartbeat');
  const streams = new Map();
  const check = async (principal) => {
    const fresh = await authorize(principal);
    if (!fresh || !textId(fresh.accountId) || !textId(fresh.connectionId) || !Array.isArray(fresh.scopes)) fail('agent_auth_required', 401);
    return fresh;
  };
  const requireTopics = (fresh, topics) => {
    if (topics.some((topic) => !fresh.scopes.includes(TOPICS[topic].scope))) fail('agent_scope_required', 403);
    if (topics.some((topic) => TOPICS[topic].source === 'coordination') && !coordination?.get) fail('event_source_unavailable', 409);
  };
  const currentCharacter = async (fresh) => (await pool.query(
    'SELECT id FROM characters WHERE account_id=$1 AND alive=true', [fresh.accountId])).rows[0]?.id || null;
  async function ownedSubscription(fresh, id) {
    if (!textId(id)) fail('event_subscription_unavailable', 404);
    const row = (await pool.query(`SELECT * FROM agent_gateway_subscriptions
      WHERE id=$1 AND connection_id=$2 AND account_id=$3 AND revoked_at IS NULL`,
    [id, fresh.connectionId, fresh.accountId])).rows[0];
    if (!row) fail('event_subscription_unavailable', 404);
    const topics = topicList(JSON.parse(row.topics_json));
    requireTopics(fresh, topics);
    return { row, topics };
  }
  async function project(row, fresh, topics, characterId) {
    if (row.source === 'notifications') {
      const topic = topics.find((candidate) => TOPICS[candidate].types?.includes(row.type));
      if (!topic) return null;
      if (topic === 'crew.request.created') {
        const payload = parseObject(row.payload);
        if (!textId(payload.crewId)) return null;
        const member = (await pool.query(`SELECT c.id FROM crews c
          JOIN crew_members m ON m.crew_id=c.id AND m.account_id=$1
          WHERE c.id=$2 AND c.leader_account=$1`, [fresh.accountId, payload.crewId])).rows[0];
        if (!member) return null;
        return { topic, data: { crewId: member.id, kind: 'join_request' } };
      }
      // Only the recipient's current character can see personal notification
      // signals. No arbitrary payload, salt, riddle solution, or organization data.
      if (!characterId || row.character_id !== characterId) return null;
      return { topic, data: topic === 'mystery.clue.discovered'
        ? { kind: 'clue_scroll' } : { kind: row.type } };
    }
    if (row.source === 'coordination') {
      if (!topics.includes(row.event_type)) return null;
      let view;
      try { view = await coordination.get(fresh.accountId, row.instance_id); }
      catch (error) {
        if (['coordination_unavailable', 'coordination_disabled'].includes(error.code)) return null;
        throw error;
      }
      if (!view || view.historical) return null;
      const payload = parseObject(row.payload_json);
      if (row.event_type.startsWith('coordination.node.')
          && !view.nodes?.some((node) => node.id === payload.nodeId)) return null;
      return { topic: row.event_type, data: { instanceId: view.id, revision: Number(row.revision),
        ...(row.event_type.startsWith('coordination.node.') ? { nodeId: payload.nodeId } : {}) } };
    }
    return { topic: 'world.event.resolved', data: {
      kind: row.kind, headline: row.headline, winner: row.winner_name || null,
    } };
  }
  async function read(principal, { subscriptionId, after, limit = 50 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail('invalid_event_limit');
    const fresh = await check(principal);
    const { topics } = await ownedSubscription(fresh, subscriptionId);
    const identity = { connectionId: fresh.connectionId, subscriptionId };
    const positions = decodeCursor(after, identity);
    const characterId = await currentCharacter(fresh);
    const queries = [];
    if (characterId && topics.some((topic) => TOPICS[topic].source === 'notifications')) {
      const types = [...new Set(topics.flatMap((topic) => TOPICS[topic].types || []))];
      const p = positions.notifications;
      queries.push(pool.query(`SELECT id, character_id, type, payload, created_at, ${cursorColumn('created_at')} AS cursor_at
        FROM notifications WHERE character_id=$1 AND type IN (${types.map((_, index) => `$${index + 5}`).join(',')})
        AND (created_at>$2 OR (created_at=$2 AND id>$3)) ORDER BY created_at,id LIMIT $4`,
      [characterId, p.at, p.id, MAX_SCAN, ...types]).then((result) => result.rows.map((row) => ({ ...row, source: 'notifications', at: row.created_at }))));
    }
    if (topics.some((topic) => TOPICS[topic].source === 'coordination')) {
      const p = positions.coordination;
      const types = topics.filter((topic) => TOPICS[topic].source === 'coordination');
      queries.push(pool.query(`SELECT e.id, e.event_type, e.instance_id, e.revision, e.payload_json,
        e.occurred_at, ${cursorColumn('e.occurred_at')} AS cursor_at FROM coordination_events e
        JOIN coordination_instances i ON i.id=e.instance_id
        WHERE i.owner_account_id=$1 AND e.event_type IN (${types.map((_, index) => `$${index + 5}`).join(',')})
        AND (e.occurred_at>$2 OR (e.occurred_at=$2 AND e.id>$3)) ORDER BY e.occurred_at,e.id LIMIT $4`,
      [fresh.accountId, p.at, p.id, MAX_SCAN, ...types]).then((result) => result.rows.map((row) => ({ ...row, source: 'coordination', at: row.occurred_at }))));
    }
    if (topics.includes('world.event.resolved')) {
      const p = positions.world;
      queries.push(pool.query(`SELECT id, kind, headline, winner_name, resolved_at, ${cursorColumn('resolved_at')} AS cursor_at
        FROM event_results WHERE resolved_at>$1 OR (resolved_at=$1 AND id>$2)
        ORDER BY resolved_at,id LIMIT $3`, [p.at, p.id, MAX_SCAN])
        .then((result) => result.rows.map((row) => ({ ...row, source: 'world', at: row.resolved_at }))));
    }
    const batches = await Promise.all(queries);
    // Keep each SQL batch's stable order, including PostgreSQL microseconds that
    // JavaScript Date cannot represent. cursor_at retains the full DB timestamp.
    const rows = batches.flat().sort((a, b) => new Date(a.at) - new Date(b.at)
      || SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source));
    const events = [];
    let scanned = 0;
    for (const row of rows) {
      if (events.length >= limit || scanned >= MAX_SCAN) break;
      scanned++;
      positions[row.source] = { at: typeof row.cursor_at === 'string' ? row.cursor_at : iso(row.cursor_at), id: row.id };
      const projected = await project(row, fresh, topics, characterId);
      if (!projected) continue;
      events.push({ id: `${row.source}:${row.id}`, ...projected, occurredAt: iso(row.at),
        source: row.source, cursor: encodeCursor(positions, identity) });
    }
    // Revocation during a slow database read must not finish with a stale grant.
    const latest = await check(principal);
    requireTopics(latest, topics);
    await ownedSubscription(latest, subscriptionId);
    if (await currentCharacter(latest) !== characterId) fail('event_character_changed', 409);
    return { events, nextCursor: encodeCursor(positions, identity),
      hasMore: scanned < rows.length || batches.some((batch) => batch.length === MAX_SCAN),
      delivery: 'timestamp_cursor_replay' };
  }
  async function subscribe(principal, { topics: input } = {}) {
    const fresh = await check(principal), topics = topicList(input);
    requireTopics(fresh, topics);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize the cap on real PostgreSQL, including concurrent connections.
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [fresh.accountId]);
      const prior = (await client.query(`SELECT * FROM agent_gateway_subscriptions
        WHERE connection_id=$1 AND account_id=$2 AND revoked_at IS NULL ORDER BY created_at,id`,
      [fresh.connectionId, fresh.accountId])).rows;
      const existing = prior.find((row) => row.topics_json === JSON.stringify(topics));
      if (existing) { await client.query('COMMIT'); return publicSubscription(existing); }
      if (prior.length >= MAX_SUBSCRIPTIONS) fail('event_subscription_limit', 429);
      const row = (await client.query(`INSERT INTO agent_gateway_subscriptions
        (id,connection_id,account_id,topics_json) VALUES ($1,$2,$3,$4) RETURNING *`,
      [crypto.randomUUID(), fresh.connectionId, fresh.accountId, JSON.stringify(topics)])).rows[0];
      await client.query('COMMIT');
      return publicSubscription(row);
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async function stream(principal, { subscriptionId, after, onEvent, onHeartbeat, onClose } = {}) {
    if (typeof onEvent !== 'function') throw new TypeError('Event delivery callback required');
    const fresh = await check(principal);
    await ownedSubscription(fresh, subscriptionId);
    const active = streams.get(fresh.accountId) || new Set();
    if (active.size >= 4) fail('event_stream_limit', 429);
    const marker = {}; active.add(marker); streams.set(fresh.accountId, active);
    let timer, wakeTimer, closed = false, running = false, pending = false, cursor = after;
    const listeners = [];
    const close = (reason = 'closed') => {
      if (closed) return;
      closed = true; clearInterval(timer); clearTimeout(wakeTimer);
      for (const [name, handler] of listeners) bus?.off(name, handler);
      active.delete(marker); if (!active.size) streams.delete(fresh.accountId);
      Promise.resolve().then(() => onClose?.(reason)).catch(() => {});
    };
    const drain = async () => {
      if (closed) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        // A fixed batch budget prevents a large history from monopolizing a stream.
        for (let batch = 0; batch < 5 && !closed; batch++) {
          const page = await read(principal, { subscriptionId, after: cursor, limit: 50 });
          for (const event of page.events) {
            if (closed) break;
            const latest = await check(principal);
            const { topics } = await ownedSubscription(latest, subscriptionId);
            requireTopics(latest, topics);
            if (await currentCharacter(latest) !== characterId) { close('event_character_changed'); break; }
            if (event.topic === 'crew.request.created' && !(await pool.query(`SELECT c.id FROM crews c
              JOIN crew_members m ON m.crew_id=c.id AND m.account_id=$1
              WHERE c.id=$2 AND c.leader_account=$1`, [latest.accountId, event.data.crewId])).rows.length) continue;
            if (event.source === 'coordination') {
              const view = await coordination.get(latest.accountId, event.data.instanceId);
              if (view.historical || (event.data.nodeId && !view.nodes?.some((node) => node.id === event.data.nodeId))) continue;
            }
            if (await onEvent(event) === false) { close('backpressure'); break; }
            cursor = event.cursor;
          }
          if (!closed) cursor = page.nextCursor;
          if (!page.hasMore) break;
        }
        if (!closed) await onHeartbeat?.({ cursor });
      } catch (error) { close(error.code || 'event_stream_failed'); }
      finally { running = false; if (pending && !closed) { pending = false; wake(); } }
    };
    const wake = () => {
      if (closed || wakeTimer) return;
      wakeTimer = setTimeout(() => { wakeTimer = null; void drain(); }, 50);
      wakeTimer.unref?.();
    };
    let characterId;
    try {
      characterId = await currentCharacter(fresh);
      for (const name of [characterId && `me:${characterId}`, 'streets'].filter(Boolean)) {
        if (bus) { bus.on(name, wake); listeners.push([name, wake]); }
      }
      timer = setInterval(() => void drain(), heartbeatMs); timer.unref?.();
      await drain();
      return { close, poll: drain, get closed() { return closed; } };
    } catch (error) { close('event_stream_failed'); throw error; }
  }
  return Object.freeze({
    async catalog(principal) {
      const fresh = await check(principal);
      return { topics: Object.entries(TOPICS).filter(([, topic]) => fresh.scopes.includes(topic.scope))
        .map(([topic, value]) => ({ topic, scope: value.scope, source: value.source, coverage: value.coverage,
          available: value.source !== 'coordination' || !!coordination?.get })),
      unavailable: UNSUPPORTED.map((topic) => ({ topic, reason: 'No authoritative durable transition source is integrated.' })),
      transport: ['cursor', 'sse'], heartbeatSeconds: heartbeatMs / 1000,
      delivery: 'timestamp_cursor_replay', maxPageSize: 100 };
    },
    subscribe, read, stream,
    async subscriptions(principal) {
      const fresh = await check(principal);
      const rows = (await pool.query(`SELECT * FROM agent_gateway_subscriptions
        WHERE connection_id=$1 AND account_id=$2 AND revoked_at IS NULL ORDER BY created_at,id LIMIT $3`,
      [fresh.connectionId, fresh.accountId, MAX_SUBSCRIPTIONS])).rows;
      return { subscriptions: rows.map(publicSubscription) };
    },
    async unsubscribe(principal, id) {
      const fresh = await check(principal);
      if (!textId(id)) fail('event_subscription_unavailable', 404);
      const result = await pool.query(`UPDATE agent_gateway_subscriptions SET revoked_at=now()
        WHERE id=$1 AND connection_id=$2 AND account_id=$3 AND revoked_at IS NULL RETURNING id`,
      [id, fresh.connectionId, fresh.accountId]);
      if (!result.rows.length) fail('event_subscription_unavailable', 404);
      return { id, active: false };
    },
  });
}
