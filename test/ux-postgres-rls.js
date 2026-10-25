// Native Community concurrency and direct-client RLS proof, isolated from every existing database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const configured = process.env.UX_TEST_DATABASE_URL;
assert(configured, 'Set UX_TEST_DATABASE_URL to the disposable loopback PostgreSQL test cluster.');
const endpoint = new URL(configured);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Native UX proof refuses remote PostgreSQL.');
assert(/^\/(?:omerta_check|omerta_ux_check|omerta_ux_[a-z0-9_]+)$/.test(endpoint.pathname), 'A named disposable omerta_check or omerta_ux_* control database is required.');
const database = 'omerta_ux_security_' + randomUUID().replaceAll('-', ''), role = 'ux_rls_' + randomUUID().replaceAll('-', '');
assert(/^omerta_ux_security_[a-f0-9]{32}$/.test(database));
assert(/^ux_rls_[a-f0-9]{32}$/.test(role));
const admin = new pg.Client({ connectionString: configured });
await admin.connect();
let app, created = false, roleCreated = false;
const tables = ['ux_workspaces', 'ux_crew_notes', 'ux_crew_signals', 'ux_community_entries', 'ux_community_documents', 'ux_community_portrait_consents', 'ux_mentor_subjects'];
try {
 await admin.query(`CREATE DATABASE ${database}`); created = true;
 const isolated = new URL(endpoint); isolated.pathname = '/' + database;
 Object.assign(process.env, { DATABASE_URL: isolated.toString(), NODE_ENV: 'test', INVITE_MODE: 'off', RATE_LIMIT: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off',
  JWT_SECRET: 'ux-native-security-fixture-' + randomUUID(), MOD_KEY: 'ux-native-security-mod-' + randomUUID(), MARKET_SEED: randomUUID().replaceAll('-', ''),
  LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City', PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true', PAYMENT_REFUND_POLICY: 'Disposable test fixture policy.' });
 const { buildServer } = await import('./server-fixture.js'); app = await buildServer(); const pool = app.pool, route = '/v1/ux/community';
 assert.equal((await pool.query('SELECT current_database() name')).rows[0].name, database, 'all fixtures must use the newly created database');
 const call = async (method, url, player, payload, status = 200) => {
  const r = await app.inject({ method, url, payload, headers: { ...(player ? { authorization: 'Bearer ' + player.token } : {}), ...(!['GET', 'HEAD'].includes(method) ? { 'idempotency-key': randomUUID() } : {}) } });
  assert.equal(r.statusCode, status, `${method} ${url}: ${r.body}`); return r.json();
 };
 const create = async (name) => { const { token } = await call('POST', '/v1/auth/guest'); const player = { token, account: app.jwt.verify(token).sub }; await call('POST', '/v1/character', player, { name }); player.ch = (await pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [player.account])).rows[0]; return player; };
 const leader = await create('Native Security Boss'), mate = await create('Native Security Mate'), stranger = await create('Native Security Other');
 await pool.query("INSERT INTO crews(id,name,leader_account) VALUES ('security-crew','Native Security Crew',$1),('security-other','Other Security Crew',$2)", [leader.account, stranger.account]);
 for (const player of [leader, mate, stranger]) await pool.query('INSERT INTO crew_members(crew_id,account_id,name,joined_at) VALUES ($1,$2,$3,$4)', [player === stranger ? 'security-other' : 'security-crew', player.account, player.ch.name, new Date(Date.now() - 3600000)]);
 const snapshot = async () => ({ characters: (await pool.query('SELECT id,cash,bank,respect,energy,nerve,health,muscle,cunning,speed FROM characters ORDER BY id')).rows, transactions: (await pool.query('SELECT COUNT(*) n FROM transactions')).rows, roles: (await pool.query('SELECT * FROM world_operation_roles ORDER BY operation_id,role_id')).rows, chats: (await pool.query('SELECT COUNT(*) n FROM chat_messages')).rows });
 const before = await snapshot();
 await call('GET', route, null, undefined, 401);
 await call('PUT', '/v1/ux/workspace', leader, { revision: 0, changes: { identity: { room: ['lamp'] } } });
 await call('POST', '/v1/ux/coordination', leader, { type: 'plan', title: 'Native security plan', nextStep: 'Read the shared terms.' });
 await call('POST', '/v1/ux/coordination', mate, { type: 'presence', message: 'Available by choice', minutes: 10 });
 await call('POST', '/v1/ux/mentor-subjects', mate, { specialties: [], helpSubject: 'Reading a shared plan', publish: true });
 const manual = (body, revision) => ({ type: 'manual', revision, sections: [{ heading: 'Crew advice', body, spoiler: false }] });
 await call('POST', route, leader, manual('Initial advice', 0));
 const race = async (bodies, players) => Promise.all(bodies.map((payload, i) => app.inject({ method: 'POST', url: route, payload, headers: { authorization: 'Bearer ' + players[i].token, 'idempotency-key': randomUUID() } })));
 const edits = await race([manual('Leader edit', 1), manual('Mate edit', 1)], [leader, mate]);
 assert.deepEqual(edits.map((r) => r.statusCode).sort(), [200, 400]);
 assert.equal(edits.find((r) => r.statusCode === 400).json().error, 'community_conflict', 'native row locks allow exactly one shared document revision winner');
 assert.equal((await call('GET', route, mate)).documents.manual.revision, 2);
 const crest = { type: 'crest', revision: 0, shape: 'shield', symbol: 'key', primary: '#1e262b', secondary: '#d3b16c', motto: 'Initial word' };
 await call('POST', route, leader, crest);
 assert.equal((await call('POST', route, mate, { ...crest, revision: 1 }, 400)).error, 'community_crest_permission');
 const crests = await race([{ ...crest, revision: 1, motto: 'First revision' }, { ...crest, revision: 1, motto: 'Second revision' }], [leader, leader]);
 assert.deepEqual(crests.map((r) => r.statusCode).sort(), [200, 400]); assert.equal(crests.find((r) => r.statusCode === 400).json().error, 'community_conflict');
 assert.equal((await call('GET', route, leader)).documents.crest.revision, 2);
 assert.deepEqual((await call('GET', route, stranger)).documents, {}, 'a different crew never reads the shared documents');
 await call('POST', route, stranger, { ...manual('Cross-crew spoof', 2), crewId: 'security-crew' }, 400);
 let board = await call('POST', route, leader, { type: 'portrait', caption: 'Native consenting crew', participants: [leader.ch.id, mate.ch.id], consentSelf: true });
 const portrait = board.entries.find((e) => e.kind === 'portrait');
 assert.equal(portrait.participants.find((p) => p.name === mate.ch.name).characterId, null);
 assert.equal((await call('GET', `${route}/portraits/${portrait.id}`, leader, undefined, 400)).error, 'community_portrait_consent');
 await call('POST', route, leader, { type: 'consent', portraitId: portrait.id, accept: true, accountId: mate.account }, 400);
 assert.equal((await call('POST', route, stranger, { type: 'consent', portraitId: portrait.id, accept: true }, 400)).error, 'community_unavailable');
 await call('POST', route, mate, { type: 'consent', portraitId: portrait.id, accept: true });
 assert.equal((await call('GET', `${route}/portraits/${portrait.id}`, leader)).participants.length, 2);
 assert.deepEqual(await snapshot(), before, 'native metadata writes move no balances, stats, energy, roles, transactions or chat messages');

 // The database owner still reads seeded rows; an otherwise granted direct SQL role cannot.
 const catalog = (await pool.query("SELECT c.relname,c.relrowsecurity,EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='omerta_direct_access_denied' AND NOT p.polpermissive) denied FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])", [tables])).rows;
 assert.equal(catalog.length, tables.length); assert.ok(catalog.every((r) => r.relrowsecurity && r.denied), 'boot enables the restrictive RLS policy on all seven new UX tables');
 await admin.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`); roleCreated = true;
 const direct = await pool.connect();
 try {
  await direct.query('BEGIN'); await direct.query(`GRANT USAGE ON SCHEMA public TO ${role}`); await direct.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
  const rows = new Map(); for (const table of tables) { const row = (await direct.query(`SELECT * FROM ${table} LIMIT 1`)).rows[0]; assert.ok(row, table + ' must contain a real fixture row before testing denial'); rows.set(table, row); }
  await direct.query(`SET LOCAL ROLE ${role}`);
  for (const table of tables) {
   assert.equal((await direct.query(`SELECT * FROM ${table}`)).rowCount, 0, table + ': direct-client SELECT is denied despite grants');
   const row = rows.get(table), fields = Object.keys(row); fields.forEach((field) => assert(/^[a-z_]+$/.test(field)));
   assert.equal((await direct.query(`UPDATE ${table} SET ${fields[0]}=${fields[0]} RETURNING ${fields[0]}`)).rowCount, 0, table + ': direct-client UPDATE cannot reach existing data');
   assert.equal((await direct.query(`DELETE FROM ${table} RETURNING ${fields[0]}`)).rowCount, 0, table + ': direct-client DELETE cannot reach existing data');
   await direct.query('SAVEPOINT ux_denied_insert');
   await assert.rejects(direct.query(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map((_, i) => '$' + (i + 1)).join(',')})`, fields.map((field) => row[field])), { code: '42501' }, table + ': direct-client INSERT is rejected by native RLS');
   await direct.query('ROLLBACK TO SAVEPOINT ux_denied_insert');
  }
  await direct.query('ROLLBACK');
 } finally { await direct.query('ROLLBACK').catch(() => {}); direct.release(); }
 console.log('Native UX RLS: all seven populated UX tables deny direct-role SELECT/INSERT/UPDATE/DELETE despite explicit grants; backend owner access remains available.');

 // Consent survives as a log for one exact character, never as permission inherited by an heir.
 const predecessor = mate.ch;
 await pool.query('UPDATE characters SET alive=false WHERE id=$1', [predecessor.id]);
 await pool.query('INSERT INTO characters(id,account_id,name,generation,season) VALUES ($1,$2,$3,$4,$5)', ['native-security-heir', mate.account, 'Native Security Heir', predecessor.generation + 1, predecessor.season]);
 const successor = (await call('GET', route, mate)).entries.find((e) => e.id === portrait.id).participants.find((p) => p.mine);
 assert.equal(successor.status, 'pending'); assert.equal(successor.characterId, null);
 assert.equal((await call('GET', `${route}/portraits/${portrait.id}`, leader, undefined, 400)).error, 'community_portrait_consent');
 await call('POST', route, mate, { type: 'consent', portraitId: portrait.id, accept: true });
 const image = await call('GET', `${route}/portraits/${portrait.id}`, leader); assert.ok(image.participants.includes('Native Security Heir')); assert.ok(!image.participants.includes(predecessor.name));
 await pool.query('DELETE FROM crew_members WHERE account_id=$1', [mate.account]);
 assert.equal((await call('POST', route, mate, manual('Former member edit', 2), 400)).error, 'no_crew');
 await pool.query('INSERT INTO crew_members(crew_id,account_id,name,joined_at) VALUES ($1,$2,$3,$4)', ['security-crew', mate.account, 'Native Security Heir', new Date()]);
 assert.ok(!(await call('GET', route, mate)).entries.some((e) => e.id === portrait.id), 'a rejoin membership cannot inherit the old portrait invitation');
 assert.equal((await call('POST', route, mate, { type: 'consent', portraitId: portrait.id, accept: true }, 400)).error, 'community_unavailable');
 assert.equal((await call('GET', `${route}/portraits/${portrait.id}`, leader, undefined, 400)).error, 'community_portrait_consent');
 console.log('Native UX Community: concurrent manual/crest revisions have one winner, leader/current-membership gates hold, and avatar consent belongs to the exact character and membership epoch; no metadata value or role movement.');
 // The newer core has no shared street clock. Exercise the actual projection and two actual
 // recorded crime actions; keep the existing odds and resource rules and control only the die.
 assert.equal((await pool.query("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema='public' AND table_name='characters' AND column_name='street_action_at'")).rows[0].n, '0');
 await pool.query('UPDATE characters SET cunning=1000,speed=1000,nerve=100,respect=10000 WHERE id=$1', [leader.ch.id]);
 const tactics = (await call('GET', '/v1/ux/tactics', leader)).tactics;
 for (const job of tactics.jobs) for (const quote of [...job.actual, ...job.proposed]) { assert.equal(Object.hasOwn(quote, 'cooldown'), false); assert.ok(quote.blockers.every(text => !/street clock/i.test(text))); assert.ok(Number.isFinite(quote.probability)); assert.ok(Number.isFinite(quote.jailSeconds)); }
 const move = tactics.jobs.flatMap(job => job.actual).find(quote => quote.approach === 'standard' && quote.blockers.length === 0);
 assert.ok(move, 'The actual tactics API must issue an eligible crime.');
 const random = Math.random;
 try {
  Math.random = () => 0.05;
  const first = await call('POST', move.path, leader, move.body), second = await call('POST', move.path, leader, move.body);
  assert.equal(first.success, true); assert.equal(second.success, true, 'Consecutive current-core jobs succeed without an invented shared cooldown.');
  assert.equal(first.decisionContext.probability, move.probability);
 } finally { Math.random = random; }
 console.log('Native UX Tactics: actual API quotes have finite odds/jail fields and no invented street clock; two consecutive recorded crime actions follow the unchanged live rules.');
} finally {
 await app?.close();
 if (app?.pool && !app.pool.ended) await app.pool.end();
 if (created) { assert(/^omerta_ux_security_[a-f0-9]{32}$/.test(database)); await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); }
 if (roleCreated) { assert(/^ux_rls_[a-f0-9]{32}$/.test(role)); await admin.query(`DROP ROLE ${role}`); }
 await admin.end();
}
