// Native storage/authorization proof. Uses a fresh disposable database on a loopback test cluster.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const configured = process.env.UX_TEST_DATABASE_URL;
assert(configured, 'Set UX_TEST_DATABASE_URL to a disposable local PostgreSQL cluster.');
const local = new URL(configured);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname), 'UX native proof refuses a remote PostgreSQL endpoint.');
const database = 'omerta_ux_native_' + randomUUID().replaceAll('-', '');
assert(/^[a-z0-9_]+$/.test(database));
const admin = new pg.Client({ connectionString: configured }); await admin.connect();
let app;
try {
  await admin.query(`CREATE DATABASE ${database}`);
  const isolated = new URL(local); isolated.pathname = '/' + database;
  process.env.DATABASE_URL = isolated.toString(); process.env.NODE_ENV = 'test'; process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.POPULATION_OFF = 'on';
  process.env.JWT_SECRET = 'ux-native-disposable-fixture'; process.env.MOD_KEY = 'ux-native-disposable-mod-fixture'; process.env.MARKET_SEED = 'uxNativeFixture7Qx2mVb9PwLn4RtY6hJc'; process.env.SOCIAL_VERIFY_MODE = 'off';
  Object.assign(process.env, { LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City', PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true', PAYMENT_REFUND_POLICY: 'Test fixture policy; not a production policy.' });
  const { buildServer } = await import('./server-fixture.js'); app = await buildServer(); const pool = app.pool;
  for (const url of ['/v1/ux/workspace', '/v1/ux/crew-workspace', '/v1/ux/community', '/v1/ux/story']) assert(app.hasRoute({ method: 'GET', url }), `${url} must be registered by the actual release server.`);
  const call = async (method, url, player, payload, status = 200) => {
    const response = await app.inject({ method, url, payload, headers: { ...(player ? { authorization: 'Bearer ' + player.token } : {}), ...(!['GET', 'HEAD'].includes(method) ? { 'idempotency-key': randomUUID() } : {}) } });
    assert.equal(response.statusCode, status, `${method} ${url}: ${response.body}`); return response.json();
  };
  const people = [];
  for (const name of ['Native UX Leader', 'Native UX Mate', 'Native UX Other']) {
    const guest = await call('POST', '/v1/auth/guest'); const person = { token: guest.token, account: app.jwt.verify(guest.token).sub };
    await call('POST', '/v1/character', person, { name }); person.ch = (await pool.query('SELECT id,name FROM characters WHERE account_id=$1 AND alive', [person.account])).rows[0]; people.push(person);
  }
  const [leader, mate, other] = people;
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES ('native-ux-crew','Native UX Crew',$1),('native-ux-other','Other UX Crew',$2)", [leader.account, other.account]);
  for (const person of people) await pool.query('INSERT INTO crew_members(crew_id,account_id,name,joined_at) VALUES ($1,$2,$3,$4)', [person === other ? 'native-ux-other' : 'native-ux-crew', person.account, person.ch.name, new Date(Date.now() - 3600000)]);
  const gameplay = async () => ({ characters: (await pool.query('SELECT id,cash,bank,respect,muscle,cunning,speed FROM characters ORDER BY id')).rows, transactions: (await pool.query('SELECT COUNT(*) n FROM transactions')).rows });
  const before = await gameplay();
  await call('GET', '/v1/ux/workspace', null, undefined, 401);
  await call('PUT', '/v1/ux/workspace', leader, { revision: 0, changes: { identity: { nicknames: { car: 'Native private name' } }, story: { annotations: [{ quote: 'A found passage', note: 'Private note' }] } } });
  assert.deepEqual((await call('GET', '/v1/ux/workspace', other)).values, {});
  await call('PUT', '/v1/ux/workspace', other, { accountId: leader.account, revision: 0, changes: { identity: { room: ['plant'] } } }, 400);
  const races = await Promise.all(['sage', 'slate'].map(accent => app.inject({ method: 'PUT', url: '/v1/ux/workspace', headers: { authorization: 'Bearer ' + leader.token, 'idempotency-key': randomUUID() }, payload: { revision: 1, changes: { feel: { accent } } } })));
  assert.deepEqual(races.map(response => response.statusCode).sort(), [200, 409], 'real concurrent workspace CAS has one winner and one explicit conflict');
  const saved = await call('GET', '/v1/ux/workspace', leader); assert.equal(saved.revision, 2); assert.equal(saved.values.identity.nicknames.car, 'Native private name');
  const plan = await call('POST', '/v1/ux/crew-workspace', leader, { type: 'plan', title: 'Native private Crew plan', nextStep: 'Read the shared board.' });
  const noteId = plan.notes.find(note => note.data.title === 'Native private Crew plan').id;
  assert.ok((await call('GET', '/v1/ux/crew-workspace', mate)).notes.some(note => note.id === noteId));
  assert.ok(!(await call('GET', '/v1/ux/crew-workspace', other)).notes.some(note => note.id === noteId));
  await call('POST', '/v1/ux/crew-workspace', other, { type: 'close', noteId }, 400);
  await call('POST', '/v1/ux/community', leader, { type: 'thread', title: 'Native marked spoiler', body: 'A consciously shared clue.', spoiler: true, anchorKind: 'question' });
  assert.ok((await call('GET', '/v1/ux/community', mate)).entries.some(entry => entry.data.title === 'Native marked spoiler'));
  assert.ok(!(await call('GET', '/v1/ux/community', other)).entries.some(entry => entry.data.title === 'Native marked spoiler'));
  await pool.query('DELETE FROM crew_members WHERE account_id=$1', [mate.account]);
  for (const [url, fields, payload] of [
    ['/v1/ux/crew-workspace', ['members', 'notes', 'operations', 'signals'], { type: 'readiness', value: 'ready' }],
    ['/v1/ux/community', ['members', 'entries', 'destinations', 'officialFacts'], { type: 'emote', emote: 'hat' }],
  ]) {
    const unavailable = await call('GET', url, mate);
    assert.equal(unavailable.available, false); assert.equal(unavailable.reason, 'no_crew'); assert.equal(unavailable.crew, null);
    for (const field of fields) assert.deepEqual(unavailable[field], [], `former members receive no ${field}`);
    if (url === '/v1/ux/community') {
      assert.deepEqual(unavailable.documents, {}); assert.deepEqual(unavailable.emotes, {});
      assert.deepEqual(unavailable.anchors, { operations: [], plans: [] }); assert.deepEqual(unavailable.crestOptions, { shapes: [], symbols: [] });
    }
    assert.equal((await call('POST', url, mate, payload, 400)).error, 'no_crew', 'metadata writes still require current membership');
  }
  assert.deepEqual(await gameplay(), before, 'private workspace and Crew planning writes do not change gameplay balances or stats');
  await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/start', leader, {});
  const story = await call('GET', '/v1/ux/story/neighborhood-initiation', leader);
  assert.equal(story.epilogue, null); assert.deepEqual(story.documents, []); assert.ok(story.cast.some(person => person.name === 'Nico Bellini'));
  assert.ok(story.variants.flatMap(variant => variant.actionTerms).every(term => typeof term.label === 'string' && typeof term.available === 'boolean'), 'modern uiActions remain actual labeled terms, not raw affordances');
  await call('GET', '/v1/ux/story/neighborhood-initiation', other, undefined, 404);
  console.log('UX native PostgreSQL proof passed: real schema, owner isolation, concurrent workspace CAS, Crew membership/revocation, private community rows, modern Story action terms and unchanged gameplay balances.');
} finally {
  await app?.close();
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`); await admin.end();
}
