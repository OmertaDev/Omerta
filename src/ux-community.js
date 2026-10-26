// Crew-authored conversation and cosmetics. Never an operation permission, economic action, or private-evidence reader.
import crypto from 'node:crypto';
import { GameError, cleanText } from './game.js';
import { DISTRICTS, MENTOR, levelOf } from './rules.js';
import { avatarSvg } from './avatar.js';
import { withCoordinationCrew, sharedCoordinationOperation } from './ux-coordination.js';

export const COMMUNITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS ux_community_entries (
 id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, author_account TEXT NOT NULL, author_name TEXT NOT NULL,
 member_since TIMESTAMPTZ NOT NULL, kind TEXT NOT NULL, anchor_kind TEXT NOT NULL DEFAULT '', anchor_id TEXT NOT NULL DEFAULT '',
 payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ux_community_entries ON ux_community_entries(crew_id,created_at);
CREATE TABLE IF NOT EXISTS ux_community_documents (
 crew_id TEXT NOT NULL, kind TEXT NOT NULL, revision INT NOT NULL DEFAULT 1, payload TEXT NOT NULL,
 updated_by TEXT NOT NULL, author_name TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(crew_id,kind)
);
CREATE TABLE IF NOT EXISTS ux_community_portrait_consents (
 portrait_id TEXT NOT NULL, account_id TEXT NOT NULL, member_since TIMESTAMPTZ NOT NULL,
 character_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(portrait_id,account_id)
);
CREATE TABLE IF NOT EXISTS ux_mentor_subjects (
 account_id TEXT PRIMARY KEY, specialties TEXT NOT NULL, help_subject TEXT NOT NULL DEFAULT '', published_until TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
const fail = (code = 'community_invalid', message = 'Check the community form and try again.') => { throw new GameError(code, message); };
const parse = (v) => { try { return JSON.parse(v); } catch { return {}; } };
const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const shape = (value, required, optional = []) => { if (!plain(value) || required.some((k) => !Object.hasOwn(value, k)) || Object.keys(value).some((k) => !required.includes(k) && !optional.includes(k))) fail(); };
const text = (v, max, empty = false) => { if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) fail(); return v.replace(/\r\n?/g, '\n').split('\n').map(cleanText).join('\n').trim(); };
const ident = (v) => { if (typeof v !== 'string' || !/^[A-Za-z0-9:_-]{1,200}$/.test(v)) fail(); return v; };
const revision = (v) => { if (!Number.isSafeInteger(v) || v < 0) fail(); };
const bool = (v) => { if (typeof v !== 'boolean') fail(); };
const stamp = (v) => new Date(v).toISOString();
const xml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const COMMUNITY_EMOTES = Object.freeze({ hat: 'tips their hat', toast: 'raises a glass', nod: 'offers a quiet nod', applause: 'offers a round of applause', salute: 'gives the crew a respectful salute' });
const CREST = { shapes: ['shield', 'circle', 'diamond'], symbols: ['key', 'star', 'laurel', 'crown'] };
const TYPES = {
 thread: [['type', 'title', 'body', 'spoiler', 'anchorKind'], ['anchorId', 'steps']],
 reply: [['type', 'threadId', 'body', 'spoiler'], ['stepId']],
 emote: [['type', 'emote'], ['threadId']],
 manual: [['type', 'revision', 'sections'], []], crest: [['type', 'revision', 'shape', 'symbol', 'primary', 'secondary', 'motto'], []],
 pin: [['type', 'title', 'destinationId', 'note', 'spoiler'], []],
 portrait: [['type', 'caption', 'participants', 'consentSelf'], []], consent: [['type', 'portraitId', 'accept'], []],
 close: [['type', 'entryId'], []], remove: [['type', 'entryId'], []],
};
export function validateCommunityInput(input) {
 if (!plain(input) || !Object.hasOwn(TYPES, input.type)) fail(); shape(input, ...TYPES[input.type]);
 if (input.type === 'thread') {
  text(input.title, 100); text(input.body, 1200); bool(input.spoiler);
  if (!['question', 'operation', 'plan'].includes(input.anchorKind) || (input.anchorKind !== 'question' && !input.anchorId) || (input.anchorKind === 'question' && input.anchorId)) fail();
  if (input.anchorId) ident(input.anchorId);
  if (input.steps !== undefined) { if (!Array.isArray(input.steps) || input.steps.length > 6) fail(); input.steps.forEach((s) => text(s, 140)); }
 }
 if (input.type === 'reply') { ident(input.threadId); text(input.body, 1200); bool(input.spoiler); if (input.stepId) ident(input.stepId); }
 if (input.type === 'emote') { if (!Object.hasOwn(COMMUNITY_EMOTES, input.emote)) fail(); if (input.threadId) ident(input.threadId); }
 if (['manual', 'crest'].includes(input.type)) revision(input.revision);
 if (input.type === 'manual') { if (!Array.isArray(input.sections) || input.sections.length > 8) fail(); for (const s of input.sections) { shape(s, ['heading', 'body', 'spoiler']); text(s.heading, 100); text(s.body, 2000); bool(s.spoiler); } }
 if (input.type === 'crest') { if (!CREST.shapes.includes(input.shape) || !CREST.symbols.includes(input.symbol) || !/^#[0-9a-f]{6}$/i.test(input.primary) || !/^#[0-9a-f]{6}$/i.test(input.secondary)) fail(); text(input.motto, 24, true); }
 if (input.type === 'pin') { text(input.title, 100); text(input.note, 400, true); bool(input.spoiler); if (!DISTRICTS.some((d) => d.id === input.destinationId)) fail('community_destination', 'Choose a permitted public district.'); }
 if (input.type === 'portrait') { text(input.caption, 140); if (input.consentSelf !== true || !Array.isArray(input.participants) || input.participants.length < 2 || input.participants.length > 8 || new Set(input.participants).size !== input.participants.length) fail(); input.participants.forEach(ident); }
 if (input.type === 'consent') { ident(input.portraitId); bool(input.accept); }
 if (['close', 'remove'].includes(input.type)) ident(input.entryId);
 return input;
}
async function membersOf(client, crewId) {
 return (await client.query(`SELECT cm.account_id,cm.joined_at,COALESCE(c.name,cm.name) AS name,c.id AS character_id
  FROM crew_members cm LEFT JOIN characters c ON c.account_id=cm.account_id AND c.alive WHERE cm.crew_id=$1`, [crewId])).rows;
}
async function visibleEntry(client, ctx, id, kind = null) {
 const row = (await client.query("SELECT * FROM ux_community_entries WHERE id=$1 AND crew_id=$2 AND created_at >= $3 AND status <> 'hidden'", [id, ctx.crew.id, ctx.since])).rows[0];
 if (!row || (kind && row.kind !== kind)) fail('community_unavailable', 'That shared entry is unavailable.'); return row;
}
async function anchor(client, ctx, kind, id) {
 if (kind === 'question') return { title: 'Crew question', steps: [] };
 if (kind === 'operation') {
  const op = await sharedCoordinationOperation(client, ctx, id);
  return { title: op.title, steps: op.nodes.filter((n) => n.type === 'operation_step').map((n) => ({ id: n.id, title: n.title })), operationId: op.id };
 }
 const plan = (await client.query("SELECT kind,data_json FROM ux_crew_notes WHERE id=$1 AND crew_id=$2 AND created_at >= $3 AND status <> 'hidden'", [id, ctx.crew.id, ctx.since])).rows[0];
 if (!plan || !['plan', 'help', 'poll', 'availability'].includes(plan.kind)) fail('community_unavailable', 'That shared plan is unavailable.');
 const data = parse(plan.data_json); return { title: data.title, steps: data.nextStep ? [{ id: 'next', title: data.nextStep }] : [] };
}
async function consentProjection(client, ctx, entry, members) {
 const rows = (await client.query('SELECT * FROM ux_community_portrait_consents WHERE portrait_id=$1', [entry.id])).rows;
 return rows.flatMap((r) => {
  const m = members.find((v) => v.account_id === r.account_id && new Date(v.joined_at || 0).getTime() === new Date(r.member_since).getTime());
  if (!m) return [];
  const accepted = r.status === 'accepted' && r.character_id === m.character_id;
  return [{ name: m.name, mine: r.account_id === ctx.accountId, status: accepted ? 'accepted' : r.status === 'declined' ? 'declined' : 'pending',
   characterId: accepted ? m.character_id : null }];
 });
}
async function projectEntries(client, ctx) {
 const members = await membersOf(client, ctx.crew.id);
 const rows = (await client.query("SELECT * FROM ux_community_entries WHERE crew_id=$1 AND created_at >= $2 AND status <> 'hidden' ORDER BY created_at DESC LIMIT 150", [ctx.crew.id, ctx.since])).rows;
 const result = [], allowedThreads = new Set();
 for (const e of rows.filter((r) => r.kind === 'thread')) {
  try { if (e.anchor_kind !== 'question') await anchor(client, ctx, e.anchor_kind, e.anchor_id); allowedThreads.add(e.id); }
  catch (error) { if (!(error instanceof GameError)) throw error; }
 }
 for (const e of rows) {
  // Root anchors are reauthorized: a hidden/deleted plan never survives through a conversation link.
  if (e.kind === 'thread' && !allowedThreads.has(e.id)) continue;
  if (['reply', 'emote'].includes(e.kind) && e.anchor_id && !allowedThreads.has(e.anchor_id)) continue;
  const payload = parse(e.payload); delete payload.requestHash;
  result.push({ id: e.id, kind: e.kind, author: e.author_name, mine: e.author_account === ctx.accountId, canModerate: e.author_account === ctx.accountId || ctx.leader,
   anchorKind: e.anchor_kind || null, anchorId: e.anchor_id || null, status: e.status, data: payload, createdAt: stamp(e.created_at),
   ...(e.kind === 'portrait' ? { participants: await consentProjection(client, ctx, e, members) } : {}) });
 }
 return result;
}
async function board(client, ctx) {
 const docs = (await client.query('SELECT kind,revision,payload,author_name,updated_at FROM ux_community_documents WHERE crew_id=$1', [ctx.crew.id])).rows;
 const operations = (await client.query('SELECT id FROM world_operations WHERE crew_id=$1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 12', [ctx.crew.id, ctx.since])).rows;
 const safeOperations = [];
 for (const row of operations) { try { const op = await sharedCoordinationOperation(client, ctx, row.id); safeOperations.push({ id: op.id, title: op.title, status: op.status, steps: op.nodes.filter((n) => n.type === 'operation_step').map((n) => ({ id: n.id, title: n.title })) }); } catch (e) { if (!(e instanceof GameError)) throw e; } }
 const plans = (await client.query("SELECT id,kind,data_json FROM ux_crew_notes WHERE crew_id=$1 AND created_at >= $2 AND status <> 'hidden' ORDER BY created_at DESC LIMIT 50", [ctx.crew.id, ctx.since])).rows.filter((n) => ['plan', 'help', 'poll', 'availability'].includes(n.kind));
 return { crew: { id: ctx.crew.id, name: ctx.crew.name, leader: ctx.leader }, serverTime: new Date().toISOString(), entries: await projectEntries(client, ctx),
  documents: Object.fromEntries(docs.map((d) => [d.kind, { revision: Number(d.revision), data: parse(d.payload), author: d.author_name, updatedAt: stamp(d.updated_at) }])),
  members: (await membersOf(client, ctx.crew.id)).map((m) => ({ name: m.name, characterId: m.character_id || null, mine: m.account_id === ctx.accountId })),
  anchors: { operations: safeOperations, plans: plans.map((n) => ({ id: n.id, title: parse(n.data_json).title })) },
  destinations: DISTRICTS.map((d) => ({ id: d.id, name: d.name })), emotes: COMMUNITY_EMOTES, crestOptions: CREST,
  officialFacts: ['Planning and conversation do not assign operation roles or move resources.', 'Only issued game actions change operation state.', 'Shared operation projections exclude role-private evidence.'] };
}
async function insertEntry(client, ctx, input, data, anchorKind = '', anchorId = '', commandKey) {
 const entryId = commandKey ? crypto.createHash('sha256').update(`community:${ctx.accountId}:${ctx.crew.id}:${commandKey}`).digest('hex') : crypto.randomUUID();
 const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const old = (await client.query('SELECT payload,created_at FROM ux_community_entries WHERE id=$1', [entryId])).rows[0];
 if (old) { if (parse(old.payload).requestHash !== hash || new Date(old.created_at) < new Date(ctx.since)) fail('community_key_reuse', 'Use a new request for a different entry.'); return { id: entryId, inserted: false }; }
 const count = Number((await client.query('SELECT COUNT(*) n FROM ux_community_entries WHERE crew_id=$1 AND author_account=$2 AND created_at >= $3', [ctx.crew.id, ctx.accountId, new Date(Date.now() - 86400000)])).rows[0].n);
 if (count >= 100) fail('community_limit', 'The daily community posting limit has been reached.');
 await client.query('INSERT INTO ux_community_entries(id,crew_id,author_account,author_name,member_since,kind,anchor_kind,anchor_id,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  [entryId, ctx.crew.id, ctx.accountId, ctx.actor.name, ctx.since, input.type, anchorKind, anchorId, JSON.stringify({ ...data, requestHash: hash })]);
 return { id: entryId, inserted: true };
}
async function writeDocument(client, ctx, kind, rev, data) {
 const row = (await client.query('SELECT revision FROM ux_community_documents WHERE crew_id=$1 AND kind=$2 FOR UPDATE', [ctx.crew.id, kind])).rows[0];
 if (Number(row?.revision || 0) !== rev) fail('community_conflict', 'Another crewmate edited this document. Refresh it before saving.');
 if (row) await client.query('UPDATE ux_community_documents SET revision=revision+1,payload=$3,updated_by=$4,author_name=$5,updated_at=$6 WHERE crew_id=$1 AND kind=$2', [ctx.crew.id, kind, JSON.stringify(data), ctx.accountId, ctx.actor.name, new Date()]);
 else await client.query('INSERT INTO ux_community_documents(crew_id,kind,payload,updated_by,author_name) VALUES ($1,$2,$3,$4,$5)', [ctx.crew.id, kind, JSON.stringify(data), ctx.accountId, ctx.actor.name]);
}
export async function communityBoard(pool, accountId) {
 try { return await withCoordinationCrew(pool, accountId, board); }
 catch (error) {
  if (!(error instanceof GameError) || error.code !== 'no_crew') throw error;
  return { available: false, reason: 'no_crew', message: 'Join a crew to share its community record.', crew: null,
   serverTime: new Date().toISOString(), entries: [], documents: {}, members: [], anchors: { operations: [], plans: [] },
   destinations: [], emotes: {}, crestOptions: { shapes: [], symbols: [] }, officialFacts: [] };
 }
}
export async function writeCommunity(pool, accountId, input, commandKey) {
 validateCommunityInput(input);
 if (commandKey !== undefined && (typeof commandKey !== 'string' || !/^[!-~]{1,200}$/.test(commandKey))) fail();
 return withCoordinationCrew(pool, accountId, async (client, ctx) => {
  if (input.type === 'manual') await writeDocument(client, ctx, 'manual', input.revision, { sections: input.sections.map((s) => ({ heading: text(s.heading, 100), body: text(s.body, 2000), spoiler: s.spoiler })), source: 'player advice' });
  else if (input.type === 'crest') {
   if (!ctx.leader) fail('community_crest_permission', 'Only the current crew leader can publish the crew crest. Everyone can preview a design.');
   await writeDocument(client, ctx, 'crest', input.revision, { shape: input.shape, symbol: input.symbol, primary: input.primary, secondary: input.secondary, motto: text(input.motto, 24, true) });
  } else if (['close', 'remove'].includes(input.type)) {
   const entry = await visibleEntry(client, ctx, input.entryId);
   if (entry.author_account !== ctx.accountId && !ctx.leader) fail('community_not_author', 'Only the author or crew leader can moderate this entry.');
   await client.query('UPDATE ux_community_entries SET status=$2,updated_at=$3 WHERE id=$1', [entry.id, input.type === 'remove' ? 'hidden' : 'closed', new Date()]);
  } else if (input.type === 'consent') {
   const portrait = await visibleEntry(client, ctx, input.portraitId, 'portrait'), data = parse(portrait.payload);
   const row = (await client.query('SELECT member_since,status FROM ux_community_portrait_consents WHERE portrait_id=$1 AND account_id=$2 FOR UPDATE', [portrait.id, ctx.accountId])).rows[0];
   if (!row || new Date(row.member_since).getTime() !== new Date(ctx.since).getTime()) fail('community_consent', 'No current portrait invitation belongs to this membership.');
   if (input.accept && Date.parse(data.expiresAt) <= Date.now()) fail('community_invitation_expired', 'That portrait invitation has expired.');
   await client.query('UPDATE ux_community_portrait_consents SET status=$3,character_id=$4,name=$5,updated_at=$6 WHERE portrait_id=$1 AND account_id=$2', [portrait.id, ctx.accountId, input.accept ? 'accepted' : 'declined', ctx.actor.id, ctx.actor.name, new Date()]);
  } else if (input.type === 'thread') {
   const source = await anchor(client, ctx, input.anchorKind, input.anchorId);
   const steps = [...source.steps, ...(input.steps || []).map((s, i) => ({ id: `step-${i + 1}`, title: text(s, 140) }))];
   if (input.anchorKind === 'operation' && input.steps?.length) fail();
   await insertEntry(client, ctx, input, { title: text(input.title, 100), body: text(input.body, 1200), spoiler: input.spoiler, anchorTitle: source.title, steps }, input.anchorKind, input.anchorId || '', commandKey);
  } else if (['reply', 'emote'].includes(input.type)) {
   let parent = null, stepTitle = null;
   if (input.threadId) {
    parent = await visibleEntry(client, ctx, input.threadId, 'thread'); if (parent.status !== 'open') fail('community_thread_closed', 'That conversation is closed.');
    if (parent.anchor_kind !== 'question') await anchor(client, ctx, parent.anchor_kind, parent.anchor_id);
    if (input.stepId) { const step = parse(parent.payload).steps?.find((s) => s.id === input.stepId); if (!step) fail('community_step_unavailable', 'Choose a shared step from this conversation.'); stepTitle = step.title; }
   }
   await insertEntry(client, ctx, input, input.type === 'emote' ? { emote: input.emote, text: COMMUNITY_EMOTES[input.emote] } : { body: text(input.body, 1200), spoiler: input.spoiler, stepId: input.stepId || null, stepTitle }, parent ? 'thread' : '', parent?.id || '', commandKey);
  } else if (input.type === 'pin') await insertEntry(client, ctx, input, { title: text(input.title, 100), destinationId: input.destinationId, destination: DISTRICTS.find((d) => d.id === input.destinationId).name, note: text(input.note, 400, true), spoiler: input.spoiler, source: 'player planning pin at a public destination' }, '', '', commandKey);
  else if (input.type === 'portrait') {
   const members = await membersOf(client, ctx.crew.id), selected = input.participants.map((id) => members.find((m) => m.character_id === id));
   if (selected.some((m) => !m) || !selected.some((m) => m.account_id === ctx.accountId)) fail('community_portrait_members', 'Choose yourself and current living crewmates only.');
   const entry = await insertEntry(client, ctx, input, { caption: text(input.caption, 140), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }, '', '', commandKey);
   if (entry.inserted) for (const m of selected) await client.query('INSERT INTO ux_community_portrait_consents(portrait_id,account_id,member_since,character_id,name,status) VALUES ($1,$2,$3,$4,$5,$6)', [entry.id, m.account_id, m.joined_at || new Date(0), m.character_id, m.name, m.account_id === ctx.accountId ? 'accepted' : 'pending']);
  }
  return { ok: true, ...(await board(client, ctx)) };
 });
}

export async function operationPlayback(pool, accountId, operationId) {
 ident(operationId);
 return withCoordinationCrew(pool, accountId, async (client, ctx) => {
  const op = await sharedCoordinationOperation(client, ctx, operationId), visible = new Map(op.nodes.map((n) => [n.id, n.title])), role = new Map(op.roles.map((r) => [r.roleId, r.title]));
  const row = (await client.query('SELECT created_at,activated_at,completed_at,canceled_at,abandoned_at FROM world_operations WHERE id=$1', [operationId])).rows[0];
  const events = [['created_at', 'Operation opened'], ['activated_at', 'Operation activated'], ['completed_at', 'Operation completed'], ['canceled_at', 'Operation canceled'], ['abandoned_at', 'Operation abandoned']].flatMap(([field, label]) => row[field] ? [{ at: stamp(row[field]), kind: 'status', label }] : []);
  const assignments = (await client.query('SELECT role_id,assigned_at FROM world_operation_roles WHERE operation_id=$1 ORDER BY assigned_at LIMIT 20', [operationId])).rows;
  for (const a of assignments) if (role.has(a.role_id)) events.push({ at: stamp(a.assigned_at), kind: 'role', label: `${role.get(a.role_id)} role filled` });
  const contributions = (await client.query('SELECT node_id,role_id,contributed_at FROM world_operation_contributions WHERE operation_id=$1 ORDER BY contributed_at LIMIT 200', [operationId])).rows;
  for (const c of contributions) if (role.has(c.role_id)) events.push({ at: stamp(c.contributed_at), kind: 'contribution', label: `${role.get(c.role_id)}: ${visible.get(c.node_id) || 'team contribution recorded'}` });
  return { operation: { id: op.id, title: op.title, status: op.status }, events: events.sort((a, b) => new Date(a.at) - new Date(b.at)), source: 'authorized recorded operation events' };
 });
}
export async function portraitDownload(pool, accountId, portraitId) {
 ident(portraitId);
 return withCoordinationCrew(pool, accountId, async (client, ctx) => {
  const entry = await visibleEntry(client, ctx, portraitId, 'portrait'), participants = (await consentProjection(client, ctx, entry, await membersOf(client, ctx.crew.id))).filter((p) => p.status === 'accepted' && p.characterId);
  if (participants.length < 2) fail('community_portrait_consent', 'At least two current participants must explicitly accept before a group portrait can be downloaded.');
  const width = Math.max(420, participants.length * 150 + 40), caption = parse(entry.payload).caption;
  const faces = participants.map((p, i) => `<g transform="translate(${20 + i * 150} 40)">${avatarSvg(p.characterId, 120)}<text x="60" y="140" text-anchor="middle" fill="#e3d8bf" font-size="13">${xml(p.name)}</text></g>`).join('');
  return { caption, participants: participants.map((p) => p.name), svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="260" viewBox="0 0 ${width} 260"><rect width="100%" height="100%" fill="#15130f"/><text x="20" y="25" fill="#e8b34b" font-family="serif" font-size="16">${xml(ctx.crew.name)}</text>${faces}<text x="20" y="225" fill="#e3d8bf" font-size="14">${xml(caption)}</text><text x="20" y="248" fill="#a4977d" font-size="10">Consenting current avatars · generated ${xml(new Date().toISOString())}</text></svg>` };
 });
}

async function mentorActor(pool, accountId) {
 const ch = (await pool.query('SELECT id,name,respect FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0];
 if (!ch) fail('no_character', 'A living character is needed to publish help subjects.'); return ch;
}
export async function mentorSubjects(pool, accountId) {
 const me = await mentorActor(pool, accountId), mine = (await pool.query('SELECT * FROM ux_mentor_subjects WHERE account_id=$1', [accountId])).rows[0];
 const rows = (await pool.query(`SELECT p.specialties,p.help_subject,p.published_until,p.account_id,c.id,c.name,c.respect FROM ux_mentor_subjects p
  JOIN characters c ON c.account_id=p.account_id AND c.alive WHERE p.published_until > $1 ORDER BY p.updated_at DESC LIMIT 100`, [new Date()])).rows;
 return { me: { characterId: me.id, canOffer: levelOf(Number(me.respect)) >= MENTOR.MIN_LVL, canSeek: levelOf(Number(me.respect)) <= MENTOR.PROTEGE_MAX_LVL,
  specialties: mine ? parse(mine.specialties) : [], helpSubject: mine?.help_subject || '', publishedUntil: mine ? stamp(mine.published_until) : null },
  people: rows.map((r) => ({ characterId: r.id, name: r.name, mine: r.account_id === accountId,
   specialties: levelOf(Number(r.respect)) >= MENTOR.MIN_LVL ? parse(r.specialties) : [], helpSubject: levelOf(Number(r.respect)) <= MENTOR.PROTEGE_MAX_LVL ? r.help_subject : '', publishedUntil: stamp(r.published_until) })).filter((p) => p.specialties.length || p.helpSubject) };
}
export async function writeMentorSubjects(pool, accountId, input) {
 shape(input, ['specialties', 'helpSubject', 'publish']); bool(input.publish); text(input.helpSubject, 120, true);
 if (!Array.isArray(input.specialties) || input.specialties.length > 5) fail(); input.specialties.forEach((s) => text(s, 50));
 if (new Set(input.specialties.map((s) => s.trim().toLowerCase())).size !== input.specialties.length) fail();
 const ch = await mentorActor(pool, accountId), level = levelOf(Number(ch.respect));
 if (input.publish && input.specialties.length && level < MENTOR.MIN_LVL) fail('mentor_subject_eligibility', 'Mentor specialties unlock with the game’s mentor eligibility.');
 if (input.publish && input.helpSubject && level > MENTOR.PROTEGE_MAX_LVL) fail('mentor_subject_eligibility', 'Newcomer help subjects are for characters eligible to seek a mentor.');
 await pool.query(`INSERT INTO ux_mentor_subjects(account_id,specialties,help_subject,published_until,updated_at) VALUES ($1,$2,$3,$4,$5)
  ON CONFLICT(account_id) DO UPDATE SET specialties=$2,help_subject=$3,published_until=$4,updated_at=$5`,
 [accountId, JSON.stringify(input.specialties.map((s) => text(s, 50))), text(input.helpSubject, 120, true), new Date(Date.now() + (input.publish ? 30 * 86400000 : -1)), new Date()]);
 return { ok: true, ...(await mentorSubjects(pool, accountId)) };
}
export function register(app, { pool, auth }) {
 const noQuery = (req, reply) => { reply.header('cache-control', 'no-store'); if (Object.keys(req.query || {}).length) fail(); };
 app.get('/v1/ux/community', { preHandler: auth }, async (req, reply) => { noQuery(req, reply); return communityBoard(pool, req.user.sub); });
 app.post('/v1/ux/community', { preHandler: auth, preValidation: async (req) => validateCommunityInput(req.body) }, async (req, reply) => { noQuery(req, reply); return writeCommunity(pool, req.user.sub, req.body, req.headers['idempotency-key']); });
 app.get('/v1/ux/community/operations/:operationId/playback', { preHandler: auth }, async (req, reply) => { noQuery(req, reply); return operationPlayback(pool, req.user.sub, req.params.operationId); });
 app.get('/v1/ux/community/portraits/:portraitId', { preHandler: auth }, async (req, reply) => { noQuery(req, reply); return portraitDownload(pool, req.user.sub, req.params.portraitId); });
 app.get('/v1/ux/mentor-subjects', { preHandler: auth }, async (req, reply) => { noQuery(req, reply); return mentorSubjects(pool, req.user.sub); });
 app.post('/v1/ux/mentor-subjects', { preHandler: auth }, async (req, reply) => { noQuery(req, reply); return writeMentorSubjects(pool, req.user.sub, req.body); });
}
