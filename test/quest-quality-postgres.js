// Additive proof for the new quality authority; existing sealed native helpers stay unchanged.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { questingPostgresTarget } from './questing-postgres.js';
import { dbCaps, migrateSchemaUnderLock } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { qualityFixture } from './lib/quest-quality-fixture.js';
import { createContentInstance, joinContentInstance, actOnContentQuality, contentInstanceBoard, releaseContentRole } from '../src/content/runtime.js';

const { endpoint, database } = questingPostgresTarget(process.env.QUEST_QUALITY_TEST_DATABASE_URL || process.env.QUESTING_TEST_DATABASE_URL);
const connection = { host: endpoint.hostname === '[::1]' ? '::1' : '127.0.0.1', port: Number(endpoint.port || 5432), database,
  user: decodeURIComponent(endpoint.username), ...(endpoint.password ? { password: decodeURIComponent(endpoint.password) } : {}),
  ssl: false, connectionTimeoutMillis: 5000 };
const schema = `quality_native_${crypto.randomBytes(8).toString('hex')}`;
assert.match(schema, /^quality_native_[a-f0-9]{16}$/);
const admin = new Pool({ ...connection, max: 2 });
const scoped = { ...connection, max: 4, options: `-c search_path=${schema} -c statement_timeout=15000 -c lock_timeout=10000` };
const pool = new Pool(scoped), peer = new Pool(scoped), priorCaps = { ...dbCaps };
let created = false, primaryFailure;
try {
  const observed = await admin.connect();
  let server;
  try {
    assert(['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(observed.connection.stream.remoteAddress),
      'The native proof client must connect only to its literal loopback target.');
    server = (await observed.query('SELECT version() AS version,current_database() AS database,inet_server_addr()::text AS address')).rows[0];
  } finally { observed.release(); }
  assert.match(server.version, /^PostgreSQL (?:16\.\d+|18\.4)(?:\s|$)/); assert.equal(server.database, database);
  await admin.query(`CREATE SCHEMA ${schema}`); created = true;
  const boot = await pool.connect();
  try { await migrateSchemaUnderLock(boot, { schemaText: fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'), compatibility: 'postgres' }); }
  finally { boot.release(); }
  Object.assign(dbCaps, { skipLocked: true, indexedTextArrayAny: true, timestampText: true });
  const first = await pool.connect(), second = await peer.connect();
  const backendPids = [];
  try { backendPids.push((await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); assert.notEqual(...backendPids); }
  finally { first.release(); second.release(); }
  const f = await qualityFixture({ native: true, pool });
  const alice = await f.identity('Native quality records'), bob = await f.identity('Native quality residents'), replacement = await f.identity('Native replacement');
  let solo = await f.start(alice, 'three-witnesses');
  const soloPublicRevision = solo.instance.revision;
  const mutate = (who, board, operation, fields, db = pool) => withCharacter(db, who.accountId, (ch, client, h) =>
    actOnContentQuality(ch, board.instance.id, { expectedRevision: board.instance.revision,
      expectedQualityRevision: board.instance.quality.revision, operation, ...fields }, client, h));
  const drafts = await Promise.allSettled([mutate(alice, solo, 'save_draft', { text: 'First independent connection', evidenceIds: [] }),
    mutate(alice, solo, 'save_draft', { text: 'Second independent connection', evidenceIds: [] }, peer)]);
  assert.equal(drafts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(drafts.filter(result => result.status === 'rejected' && result.reason.code === 'stale_quality').length, 1);
  solo = await f.read(alice, solo); assert.equal(solo.instance.quality.revision, 1);
  assert.equal(solo.instance.revision, soloPublicRevision, 'Private CAS does not advance public state.');

  const crewId = crypto.randomUUID();
  await pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [crewId, 'Native quality crew', alice.accountId]);
  for (const who of [alice, bob, replacement]) await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [crewId, who.accountId, who.accountId.slice(0, 8)]);
  let board = await f.as(alice, (ch, client, h) => createContentInstance(ch, f.packs.get('quality-small-fire').namespace,
    { scopeKind: 'crew', roleId: 'records', consent: true }, client, h));
  board = await f.as(bob, (ch, client, h) => joinContentInstance(ch, board.instance.id,
    { expectedRevision: board.instance.revision, roleId: 'residents', consent: true }, client, h));
  board = await f.read(alice, board); board = await f.act(alice, board, board.instance.actions[0]);
  const bobBoard = await f.read(bob, board), publicRevision = board.instance.revision;
  const privateWrites = await Promise.all([mutate(alice, board, 'save_draft', { text: 'Alice private', evidenceIds: [] }),
    mutate(bob, bobBoard, 'save_draft', { text: 'Bob private', evidenceIds: [] }, peer)]);
  assert(privateWrites.every(result => result.instance.revision === publicRevision));
  assert.equal((await f.read(alice, board)).instance.quality.draft.text, 'Alice private');
  assert.equal((await f.read(bob, board)).instance.quality.draft.text, 'Bob private');
  board = await f.read(alice, board);
  for (const nodeId of ['register', 'whistle', 'stove', 'join']) {
    const action = board.instance.actions.find(item => item.nodeId === nodeId); assert(action);
    board = await f.act(alice, board, action, f.answer(board, action));
  }
  const other = await f.read(bob, board), aliceId = board.instance.quality.ownMemberId, bobId = other.instance.quality.ownMemberId;
  const proposals = await Promise.allSettled([mutate(alice, board, 'propose_mandate', { nodeId: 'brief', delegateAccountId: aliceId }),
    mutate(bob, other, 'propose_mandate', { nodeId: 'brief', delegateAccountId: bobId }, peer)]);
  assert.equal(proposals.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(proposals.filter(result => result.status === 'rejected' && result.reason.code === 'stale_instance').length, 1,
    'Concurrent public proposals serialize against the same instance revision.');
  board = await f.read(alice, board);
  const mandate = board.instance.quality.delegations[0]; assert(mandate);
  const departing = mandate.delegateAccountId === aliceId ? alice : bob;
  let departingBoard = await f.read(departing, board);
  await f.as(departing, (ch, client, h) => releaseContentRole(ch, board.instance.id,
    { expectedRevision: departingBoard.instance.revision }, client, h));
  await assert.rejects(() => mutate(departing, departingBoard, 'acknowledge_mandate', { nodeId: 'brief' }),
    error => ['not_member', 'stale_instance'].includes(error.code));
  const remaining = departing === alice ? bob : alice;
  let current = await f.read(remaining, board);
  current = await mutate(remaining, current, 'clear_mandate', { nodeId: 'brief' });
  assert.equal(current.instance.quality.delegations.length, 0, 'A departed proposer/delegate cannot strand a mandate.');
  const roleId = departing === alice ? 'records' : 'residents';
  const joined = await f.as(replacement, (ch, client, h) => joinContentInstance(ch, board.instance.id,
    { expectedRevision: current.instance.revision, roleId, consent: true }, client, h));
  assert(joined.instance.quality.participants.some(member => member.isMe));
  assert.equal(joined.instance.quality.draft.text, '', 'A role replacement never inherits someone else’s private reasoning.');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n), 0);
  console.log(JSON.stringify({ phase: 'QUEST_QUALITY_NATIVE', nativePostgres: true, postgres: server.version.split(' ')[1], backendPids,
    privateCasRace: true, crossActorPrivateWrites: true, publicProposalRace: true, safeExitAndReplacement: true,
    independentConnections: true, pgMemFallback: false, economicTransactions: 0 }));
} catch (error) { primaryFailure = error; throw error; }
finally {
  Object.assign(dbCaps, priorCaps);
  await Promise.all([pool.end(), peer.end()]);
  try { if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
  catch (error) { if (!primaryFailure) throw error; console.error(`Native cleanup also failed: ${error.code || error.message}`); }
  finally { await admin.end(); }
}
