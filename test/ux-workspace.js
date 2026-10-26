import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { validWorkspace } from '../src/ux-workspace.js';

assert(!process.env.DATABASE_URL, 'Workspace checks use disposable pg-mem only.');
const app = await buildServer();
try {
  const guest = async () => (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const alice = await guest(), bob = await guest();
  const request = (token, method = 'GET', payload) => app.inject({ method, url: '/v1/ux/workspace', headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
  assert.equal((await request(null)).statusCode, 401);
  assert.equal((await request(null, 'PUT', { revision: 0, changes: { layout: {} } })).statusCode, 401);
  const before = Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  const empty = await request(alice);
  assert.equal(empty.statusCode, 200); assert.equal(empty.json().revision, 0);
  assert.equal((await app.pool.query('SELECT * FROM ux_workspaces')).rows.length, 0, 'Reading an empty workspace performs no writes.');
  let saved = await request(alice, 'PUT', { revision: 0, changes: { investigation: { theories: [{ id: 'a', text: 'Follow the found letter.' }] }, layout: { density: 'large' } } });
  assert.equal(saved.statusCode, 200, saved.body); assert.equal(saved.json().revision, 1);
  assert.equal((await request(bob)).json().revision, 0, 'Another account cannot read Alice’s presentation state.');
  const second = await request(alice); assert.equal(second.json().values.investigation.theories[0].text, 'Follow the found letter.');
  saved = await request(alice, 'PUT', { revision: 1, changes: { tactics: { plan: ['job-a'] } } });
  assert.equal(saved.statusCode, 200); assert.equal(saved.json().values.layout.density, 'large', 'Unchanged namespaces are retained.');
  assert.equal((await request(alice, 'PUT', { revision: 1, changes: { layout: { density: 'compact' } } })).statusCode, 409);
  for (const changes of [{ secret: 'not a namespace' }, { investigation: { token: 'credential' } }, { layout: { note: 'x'.repeat(8001) } }, { tactics: { a: Array(301).fill(0) } }]) {
    assert.equal((await request(alice, 'PUT', { revision: 2, changes })).statusCode, 400);
  }
  assert.equal((await request(alice, 'PUT', { revision: 2, changes: { layout: {} }, accountId: app.jwt.verify(bob).sub })).statusCode, 400);
  const races = await Promise.all([request(alice, 'PUT', { revision: 2, changes: { layout: { density: 'compact' } } }), request(alice, 'PUT', { revision: 2, changes: { world: { memories: [] } } })]);
  assert.deepEqual(races.map(reply => reply.statusCode).sort(), [200, 409], 'Competing devices cannot both overwrite the same revision.');
  assert.equal(races.find(reply => reply.statusCode === 409).json().revision, 3, 'A lost race includes the current own-account revision for conflict resolution.');
  assert.ok(races.find(reply => reply.statusCode === 409).json().values);
  assert.equal((await request(bob)).json().revision, 0);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), before, 'Presentation changes move no currency.');
  assert.equal(validWorkspace(JSON.parse('{"__proto__":{"admin":true}}')), false);
  assert.equal(validWorkspace({ a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: 1 } } } } } } } } } } }), false);
  console.log('Workspace server checks passed: authentication, account isolation, conflict concurrency, bounded data, migration, read purity, and no value movement.');
} finally { await app.close(); }
