import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
assert(!process.env.DATABASE_URL, 'Family API uses only an isolated memory database');
const names = ['COORDINATION_ENGINE', 'COORDINATION_OPERATIONS', 'WORLD_GRAPH_KERNEL',
  'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_ACCOUNT_IDS'];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const key = () => crypto.randomUUID(), base = '/v1/coordination/operations';
let app;
async function fixture(accountId) {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES($1,$2,$3,1,'foundry',1000)",
    [`${accountId}-ch`, accountId, accountId]);
  return app.jwt.sign({ sub: accountId, tv: 0 });
}
const request = (method, url, token, payload, commandKey) => app.inject({ method, url,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(commandKey ? { 'idempotency-key': commandKey } : {}) }, ...(payload === undefined ? {} : { payload }) });
const ok = (response) => { assert.equal(response.statusCode, 200, response.body); return response.json(); };
try {
  for (const name of names) delete process.env[name];
  app = await buildServer();
  const disabled = await fixture('Family Disabled');
  assert.equal((await request('GET', base, disabled)).statusCode, 404);
  await app.close();
  for (const name of names.slice(0, 5)) process.env[name] = 'on';
  process.env.COORDINATION_ACCOUNT_IDS = 'family-api-boss,family-api-member,family-api-stranger';
  app = await buildServer();
  const boss = await fixture('family-api-boss'), member = await fixture('family-api-member');
  const stranger = await fixture('family-api-stranger'), excluded = await fixture('family-api-excluded');
  await app.pool.query("INSERT INTO crews(id,name,leader_account) VALUES('family-api-crew','API Crew','family-api-boss')");
  await app.pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('family-api-crew','family-api-boss','Boss')");
  await app.pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('family-api-crew','family-api-member','Member')");
  await app.pool.query("INSERT INTO gangs(id,name,tag) VALUES('family-api-gang','API Family','API')");
  await app.pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('family-api-gang','family-api-boss-ch','boss')");
  await app.pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('family-api-gang','family-api-member-ch','soldier')");
  assert.equal((await request('GET', base)).statusCode, 401);
  assert.equal((await request('GET', base, excluded)).statusCode, 404);
  assert.equal((await request('GET', base, stranger)).statusCode, 404);
  const catalog = ok(await request('GET', base, boss));
  const definitionId = catalog.operations[0].id;
  assert(!JSON.stringify(catalog).includes('sourceRoot'));
  assert(!JSON.stringify(catalog).includes('facility:foundry_archive'));
  assert.equal((await request('POST', base, member, { definitionId }, key())).statusCode, 403);
  for (const body of [{ definitionId, familyId: 'forged' }, { definitionId: 17 }, {}, []])
    assert.equal((await request('POST', base, boss, body, key())).statusCode, 400);
  assert.equal((await request('POST', base, boss, { definitionId })).statusCode, 400);
  const createKey = key(), created = ok(await request('POST', base, boss, { definitionId }, createKey));
  const operationId = created.operationId, path = `${base}/${operationId}`;
  assert.deepEqual(ok(await request('POST', base, boss, { definitionId }, createKey)), created);
  const action = (name, actor, body = {}, commandKey = key()) => request('POST', `${path}/actions/${name}`, actor, body, commandKey);
  assert.equal((await request('GET', path, stranger)).statusCode, 404);
  assert.deepEqual((await request('GET', path, stranger)).json(), (await request('GET', `${base}/missing`, stranger)).json());
  ok(await action('publish', boss));
  assert.equal((await action('assign', member, { roleId: 'supplier', accountId: 'family-api-boss' })).statusCode, 403);
  ok(await action('assign', boss, { roleId: 'supplier', accountId: 'family-api-member' }));
  ok(await action('join', boss, { roleId: 'organizer' }));
  const view = ok(await request('GET', path, member));
  assert(view.roles.find((r) => r.id === 'supplier').mine);
  for (const secret of ['family-api-boss', 'family-api-boss-ch', 'resolution_seed', 'coordination_definition', 'sourceRoot'])
    assert(!JSON.stringify(view).includes(secret), secret);
  assert.equal((await action('execute', member)).statusCode, 409);
  assert.equal((await action('contribute', boss, { requirementId: 'funding', amount: 1 })).statusCode, 400);
  ok(await action('commit', boss, { requirementId: 'funding' }));
  const contributeKey = key();
  let lost = false;
  const original = app.pool.query;
  app.pool.query = async function (sql, args) {
    if (!lost && String(sql).startsWith('UPDATE idempotency SET status=') && args?.[1] === contributeKey) {
      lost = true; throw new Error('Injected lost HTTP receipt acknowledgement');
    }
    return original.call(this, sql, args);
  };
  let contribution;
  try { contribution = ok(await action('contribute', boss, { requirementId: 'funding' }, contributeKey)); }
  finally { app.pool.query = original; }
  assert(lost);
  assert.equal((await app.pool.query('SELECT status FROM idempotency WHERE account_id=$1 AND key=$2', ['family-api-boss', contributeKey])).rows[0].status, 0);
  assert.deepEqual(ok(await action('contribute', boss, { requirementId: 'funding' }, contributeKey)), contribution);
  assert.equal(Number((await app.pool.query("SELECT cash FROM characters WHERE id='family-api-boss-ch'")).rows[0].cash), 900);
  assert.equal(Number((await app.pool.query("SELECT count(*) AS n FROM transactions WHERE reason='coordination:capital:deposit'")).rows[0].n), 1);
  ok(await action('withdraw', boss, { requirementId: 'funding' }));
  assert.equal(Number((await app.pool.query("SELECT cash FROM characters WHERE id='family-api-boss-ch'")).rows[0].cash), 1000);
  ok(await action('leave', member));
  ok(await action('cancel', boss));
  assert.equal((await familyOperationInvariants(app.pool)).ok, true);
  assert.equal(ok(await request('GET', base, boss)).instances[0].status, 'canceled');
  console.log('family-operations-api: mounted policy, strict inputs, assignment, redaction, capital and lost HTTP receipt recovery passed');
} finally {
  if (app) await app.close();
  for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
}
