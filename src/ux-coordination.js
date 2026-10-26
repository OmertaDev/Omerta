// Crew planning metadata. These records confer no operation role, reservation, item, or economic authority.
import crypto from 'node:crypto';
import { GameError, cleanText } from './game.js';
import { createOperationContext, operationBoard } from './operations.js';
import { PHASE1_WORLD_GRAPH, requireCurrentCrewOperation } from './routes/worldgraph.js';

export const COORDINATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS ux_crew_notes (
  id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, author_account TEXT NOT NULL, author_name TEXT NOT NULL,
  kind TEXT NOT NULL, operation_id TEXT NOT NULL DEFAULT '', data_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ux_crew_notes ON ux_crew_notes(crew_id,created_at);
CREATE TABLE IF NOT EXISTS ux_crew_signals (
  crew_id TEXT NOT NULL, subject_id TEXT NOT NULL, account_id TEXT NOT NULL, kind TEXT NOT NULL,
  member_since TIMESTAMPTZ NOT NULL, data_json TEXT NOT NULL, expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(crew_id,subject_id,account_id,kind)
);
CREATE INDEX IF NOT EXISTS ix_ux_crew_signals ON ux_crew_signals(crew_id,updated_at);
`;
const fail = (code = 'bad_crew_planning', message = 'Check the planning form and try again.') => { throw new GameError(code, message); };
const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const shape = (v, required, optional = []) => {
  if (!plain(v) || required.some((k) => !Object.hasOwn(v, k)) || Object.keys(v).some((k) => !required.includes(k) && !optional.includes(k))) fail();
};
const text = (v, max, empty = false) => {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()) || /[\u0000-\u001f\u007f]/.test(v)) fail();
  return cleanText(v).trim();
};
const id = (v) => { if (typeof v !== 'string' || !/^[A-Za-z0-9:_-]{1,200}$/.test(v)) fail(); return v; };
const parse = (value) => { try { return JSON.parse(value); } catch { return {}; } };
const stamp = (value) => new Date(value).toISOString();
const noteNames = { plan: 'Plan', help: 'Help request', poll: 'Planning poll', availability: 'Availability poll', clue: 'Shared lead', handoff: 'Handoff summary', debrief: 'Operation debrief' };
const fields = {
  plan: [['type', 'title'], ['operationId', 'nextStep']],
  help: [['type', 'title', 'details', 'nextStep'], ['operationId']],
  poll: [['type', 'title', 'options', 'minutes'], ['operationId']],
  availability: [['type', 'title', 'slots', 'timezone'], ['operationId']],
  readiness: [['type', 'value'], ['operationId', 'note']],
  pledge: [['type', 'what', 'quantity'], ['operationId']],
  presence: [['type', 'message', 'minutes'], []],
  vote: [['type', 'noteId', 'option'], []],
  clue: [['type', 'operationId', 'nodeId'], []],
  handoff: [['type', 'operationId', 'targetCharacterId', 'note'], []],
  debrief: [['type', 'operationId'], []],
  close: [['type', 'noteId'], []],
  remove: [['type', 'noteId'], []],
};
export function validateCoordinationInput(input) {
  if (!plain(input) || !Object.hasOwn(fields, input.type)) fail();
  shape(input, ...fields[input.type]);
  if (Object.hasOwn(input, 'operationId')) id(input.operationId);
  if (Object.hasOwn(input, 'title')) text(input.title, 100);
  if (Object.hasOwn(input, 'nextStep')) text(input.nextStep, 240, true);
  if (Object.hasOwn(input, 'details')) text(input.details, 600);
  if (Object.hasOwn(input, 'noteId')) id(input.noteId);
  if (Object.hasOwn(input, 'nodeId')) id(input.nodeId);
  if (Object.hasOwn(input, 'targetCharacterId')) id(input.targetCharacterId);
  if (Object.hasOwn(input, 'note')) text(input.note, 240, true);
  if (input.type === 'readiness' && !['ready', 'waiting', 'not_ready'].includes(input.value)) fail();
  if (input.type === 'pledge' && (!Number.isSafeInteger(input.quantity) || input.quantity < 0 || input.quantity > 1000000)) fail();
  if (input.type === 'pledge') text(input.what, 80);
  if (input.type === 'presence') { text(input.message, 100, input.minutes === 0); if (![0, 10, 30, 60].includes(input.minutes)) fail(); }
  if (input.type === 'poll') {
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 6 || ![30, 60, 240, 1440].includes(input.minutes)) fail();
    input.options.forEach((v) => text(v, 80));
    if (new Set(input.options.map((v) => v.trim().toLowerCase())).size !== input.options.length) fail();
  }
  if (input.type === 'availability') {
    text(input.timezone, 80);
    try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { fail(); }
    if (!Array.isArray(input.slots) || input.slots.length < 2 || input.slots.length > 6) fail();
    input.slots.forEach((v) => { if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v))) fail(); });
    if (new Set(input.slots).size !== input.slots.length) fail();
  }
  if (input.type === 'vote' && (!Number.isInteger(input.option) || input.option < 0 || input.option > 5)) fail();
  return input;
}

async function withCrew(pool, accountId, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const initial = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0];
    if (!initial) fail('no_crew', 'Join a crew to use its planning room.');
    const crew = (await client.query('SELECT id,name,leader_account FROM crews WHERE id=$1 FOR UPDATE', [initial.crew_id])).rows[0];
    const member = (await client.query('SELECT crew_id,joined_at FROM crew_members WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
    if (!crew || !member || member.crew_id !== crew.id) fail('crew_changed', 'Your crew changed. Open the current crew room.');
    const actor = (await client.query('SELECT id,name FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0];
    if (!actor) fail('no_character', 'A living character is needed to plan with the crew.');
    const context = { accountId, crew, actor, since: member.joined_at || new Date(0), leader: crew.leader_account === accountId };
    const value = await work(client, context);
    await client.query('COMMIT'); return value;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

async function sharedOperation(client, ctx, operationId) {
  const row = (await client.query('SELECT id FROM world_operations WHERE id=$1 AND crew_id=$2 AND created_at >= $3', [operationId, ctx.crew.id, ctx.since])).rows[0];
  if (!row) fail('planning_unavailable', 'That shared operation is unavailable.');
  await requireCurrentCrewOperation(client, ctx.accountId, operationId);
  const board = await operationBoard(client, createOperationContext({ registry: PHASE1_WORLD_GRAPH, accountId: ctx.accountId, now: new Date().toISOString() }), operationId);
  // This is the shared board, never roleBoard: private evidence is absent by construction.
  return { id: board.operationId || operationId, status: board.status, title: board.nodes.find((n) => n.id === board.graph?.operationNodeId)?.title || board.graph?.operationNodeId || operationId,
    roles: (board.roles || []).map((r) => ({ roleId: r.roleId, title: r.title, filled: !!r.filled, contributions: Number(r.contributions) || 0 })),
    nodes: (board.nodes || []).map((n) => ({ id: n.id, type: n.type, title: n.title, status: n.status })) };
}
// Shared metadata extensions reuse this membership epoch and the public operation projection.
export { withCrew as withCoordinationCrew, sharedOperation as sharedCoordinationOperation };
const operationSummary = (operation) => ({ operationId: operation.id, status: operation.status,
  openRoles: operation.roles.filter((r) => !r.filled).map((r) => r.title),
  completedSteps: operation.nodes.filter((n) => n.type === 'operation_step' && n.status === 'completed').map((n) => n.title),
  awaitedSteps: operation.nodes.filter((n) => n.type === 'operation_step' && n.status === 'pending').map((n) => n.title),
  contributionCount: operation.roles.reduce((n, r) => n + r.contributions, 0) });

async function board(client, ctx) {
  const raw = (await client.query("SELECT * FROM ux_crew_notes WHERE crew_id=$1 AND created_at >= $2 AND status <> 'hidden' ORDER BY created_at DESC LIMIT 100", [ctx.crew.id, ctx.since])).rows;
  const members = (await client.query(`SELECT cm.account_id,cm.joined_at,COALESCE(c.name,cm.name) AS name,c.id AS character_id
    FROM crew_members cm LEFT JOIN characters c ON c.account_id=cm.account_id AND c.alive WHERE cm.crew_id=$1`, [ctx.crew.id])).rows;
  const memberMap = new Map(members.map((m) => [m.account_id, m]));
  const signals = (await client.query('SELECT * FROM ux_crew_signals WHERE crew_id=$1 ORDER BY updated_at DESC LIMIT 500', [ctx.crew.id])).rows.filter((s) => {
    const member = memberMap.get(s.account_id);
    return member && new Date(member.joined_at || 0).getTime() === new Date(s.member_since).getTime()
      && new Date(s.updated_at) >= new Date(ctx.since) && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
  });
  const notes = raw.map((n) => {
    const data = parse(n.data_json), votes = signals.filter((s) => s.kind === 'vote' && s.subject_id === n.id);
    delete data.requestHash;
    return { id: n.id, kind: n.kind, kindName: noteNames[n.kind] || 'Crew entry', operationId: n.operation_id || null, author: n.author_name, mine: n.author_account === ctx.accountId,
      canModerate: n.author_account === ctx.accountId || ctx.leader, status: n.status, createdAt: stamp(n.created_at), data,
      ...(['poll', 'availability'].includes(n.kind) ? { votes: (data.options || data.slots || []).map((_, index) => votes.filter((v) => parse(v.data_json).option === index).length),
        myVote: votes.find((v) => v.account_id === ctx.accountId) ? parse(votes.find((v) => v.account_id === ctx.accountId).data_json).option : null } : {}) };
  });
  const operationRows = (await client.query('SELECT id FROM world_operations WHERE crew_id=$1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 8', [ctx.crew.id, ctx.since])).rows;
  const operations = [];
  for (const op of operationRows) {
    try { const value = await sharedOperation(client, ctx, op.id); operations.push({ ...value, summary: operationSummary(value) }); }
    catch (error) { if (!(error instanceof GameError)) throw error; }
  }
  return { crew: { id: ctx.crew.id, name: ctx.crew.name, leader: ctx.leader }, serverTime: new Date().toISOString(),
    members: members.map((m) => ({ name: m.name, characterId: m.character_id || null, mine: m.account_id === ctx.accountId })), notes, operations,
    signals: signals.filter((s) => s.kind !== 'vote').map((s) => ({ kind: s.kind, subjectId: s.subject_id, name: memberMap.get(s.account_id).name,
      mine: s.account_id === ctx.accountId, data: parse(s.data_json), updatedAt: stamp(s.updated_at), expiresAt: s.expires_at ? stamp(s.expires_at) : null })) };
}

async function setSignal(client, ctx, subjectId, kind, data, expiresAt = null) {
  await client.query(`INSERT INTO ux_crew_signals (crew_id,subject_id,account_id,kind,member_since,data_json,expires_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (crew_id,subject_id,account_id,kind)
    DO UPDATE SET member_since=$5,data_json=$6,expires_at=$7,updated_at=$8`,
  [ctx.crew.id, subjectId, ctx.accountId, kind, ctx.since, JSON.stringify(data), expiresAt, new Date()]);
}

export const coordinationBoard = (pool, accountId) => withCrew(pool, accountId, board);
export async function writeCoordination(pool, accountId, input, commandKey) {
  validateCoordinationInput(input);
  if (commandKey !== undefined && (typeof commandKey !== 'string' || !/^[!-~]{1,200}$/.test(commandKey))) fail();
  return withCrew(pool, accountId, async (client, ctx) => {
    const operation = input.operationId ? await sharedOperation(client, ctx, input.operationId) : null;
    const subject = input.operationId || 'crew';
    if (input.type === 'readiness') await setSignal(client, ctx, subject, 'readiness', { value: input.value, note: text(input.note || '', 240, true) });
    else if (input.type === 'pledge') await setSignal(client, ctx, subject, 'pledge', { what: text(input.what, 80), quantity: input.quantity });
    else if (input.type === 'presence') await setSignal(client, ctx, 'crew', 'presence', { message: text(input.message, 100, input.minutes === 0) }, new Date(Date.now() + input.minutes * 60000));
    else if (['vote', 'close', 'remove'].includes(input.type)) {
      const note = (await client.query("SELECT * FROM ux_crew_notes WHERE id=$1 AND crew_id=$2 AND created_at >= $3 AND status <> 'hidden' FOR UPDATE", [input.noteId, ctx.crew.id, ctx.since])).rows[0];
      if (!note) fail('planning_unavailable', 'That planning entry is unavailable.');
      if (input.type === 'vote') {
        const data = parse(note.data_json), options = data.options || data.slots;
        if (!['poll', 'availability'].includes(note.kind) || note.status !== 'open' || !Array.isArray(options) || input.option >= options.length || Date.parse(data.closesAt) <= Date.now()) fail('poll_closed', 'That poll is closed.');
        await setSignal(client, ctx, note.id, 'vote', { option: input.option });
      } else {
        if (note.author_account !== ctx.accountId && !ctx.leader) fail('not_planning_author', 'Only its author or the crew leader can close or remove this entry.');
        await client.query('UPDATE ux_crew_notes SET status=$2,updated_at=$3 WHERE id=$1', [note.id, input.type === 'remove' ? 'hidden' : 'closed', new Date()]);
      }
    } else {
      let data;
      if (input.type === 'clue') {
        const clue = operation.nodes.find((n) => n.id === input.nodeId && ['evidence', 'operation_step'].includes(n.type) && n.status === 'completed');
        if (!clue) fail('clue_not_shared', 'Choose completed evidence from the shared operation board.');
        data = { title: clue.title, nodeId: clue.id, source: 'shared operation evidence', status: clue.status };
      } else if (input.type === 'handoff') {
        const target = (await client.query(`SELECT c.name FROM crew_members cm JOIN characters c ON c.account_id=cm.account_id AND c.alive
          WHERE cm.crew_id=$1 AND c.id=$2`, [ctx.crew.id, input.targetCharacterId])).rows[0];
        if (!target) fail('handoff_target', 'Choose a current crewmate for this handoff.');
        data = { title: `Handoff to ${target.name}`, target: target.name, note: text(input.note, 240, true), ...operationSummary(operation) };
      } else if (input.type === 'debrief') {
        if (!['completed', 'canceled', 'abandoned'].includes(operation.status)) fail('operation_open', 'A factual debrief is available once the operation closes.');
        data = { title: 'Operation debrief', ...operationSummary(operation) };
      } else if (input.type === 'poll') data = { title: text(input.title, 100), options: input.options.map((v) => text(v, 80)), closesAt: new Date(Date.now() + input.minutes * 60000).toISOString() };
      else if (input.type === 'availability') {
        if (input.slots.some((v) => Date.parse(v) <= Date.now() || Date.parse(v) > Date.now() + 30 * 86400000)) fail('bad_poll_time', 'Choose times in the next 30 days.');
        data = { title: text(input.title, 100), slots: input.slots, timezone: input.timezone, closesAt: new Date(Math.min(...input.slots.map(Date.parse))).toISOString() };
      } else data = { title: text(input.title, 100), ...(input.details ? { details: text(input.details, 600) } : {}), nextStep: text(input.nextStep || '', 240, true) };
      const noteId = commandKey ? crypto.createHash('sha256').update(`${ctx.accountId}:${ctx.crew.id}:${commandKey}`).digest('hex') : crypto.randomUUID();
      const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const existing = (await client.query('SELECT kind,operation_id,data_json,created_at FROM ux_crew_notes WHERE id=$1', [noteId])).rows[0];
      if (!existing) {
        const recent = Number((await client.query('SELECT COUNT(*) n FROM ux_crew_notes WHERE crew_id=$1 AND author_account=$2 AND created_at >= $3', [ctx.crew.id, ctx.accountId, new Date(Date.now() - 86400000)])).rows[0].n);
        if (recent >= 20) fail('planning_limit', 'Twenty planning entries per day is the limit. Update signals or revisit an existing entry.');
        await client.query('INSERT INTO ux_crew_notes (id,crew_id,author_account,author_name,kind,operation_id,data_json) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [noteId, ctx.crew.id, ctx.accountId, ctx.actor.name, input.type, input.operationId || '', JSON.stringify({ ...data, requestHash })]);
      } else if (existing.kind !== input.type || existing.operation_id !== (input.operationId || '') || parse(existing.data_json).requestHash !== requestHash || new Date(existing.created_at) < new Date(ctx.since)) fail('planning_key_reuse', 'Use a fresh request for a different planning entry.');
    }
    return { ok: true, ...(await board(client, ctx)) };
  });
}

export function register(app, { pool, auth }) {
  app.get('/v1/ux/crew-workspace', { preHandler: auth }, async (req, reply) => {
    reply.header('cache-control', 'no-store'); if (Object.keys(req.query || {}).length) fail();
    return coordinationBoard(pool, req.user.sub);
  });
  app.post('/v1/ux/crew-workspace', { preHandler: auth, preValidation: async (req) => validateCoordinationInput(req.body) }, async (req, reply) => {
    reply.header('cache-control', 'no-store'); if (Object.keys(req.query || {}).length) fail();
    return writeCoordination(pool, req.user.sub, req.body, req.headers['idempotency-key']);
  });
}
