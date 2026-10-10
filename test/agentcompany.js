import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { setAgentCompany, ownAgentCompany, getAgentCompany, publicAgentCompany } from '../src/agentcompany.js';
import { register as registerResources } from '../src/routes/resources.js';

const database = await commandDatabase('agentcompany'); const pool = database.pool;
const owner = 'company-owner', rival = 'company-rival';
const body = (revision, premises = null, published = true) => ({ expectedRevision: revision, name: 'Omertà Research', published, premises });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === `resource_${code}`);
const oldIntake = process.env.RESOURCE_ECONOMY; process.env.RESOURCE_ECONOMY = 'off';
try {
  for (const id of [owner, rival]) await addPlayer(pool, id);
  assert.deepEqual(await ownAgentCompany(pool, owner), { company: null });
  await rejects(getAgentCompany(pool, owner), 'not_found');
  const initial = await setAgentCompany(pool, owner, body(0));
  assert.equal(initial.company.revision, 1); assert.equal(initial.company.premises, null);
  for (const [kind, key, district] of [[null,'invalid',null],[null,null,'invalid'],['estate',null,null],['estate',owner,'docks'],['street','invalid',null]]) {
    await assert.rejects(() => pool.query('UPDATE agent_company_profiles SET premises_kind=$2,premises_key=$3,premises_district=$4 WHERE account_id=$1',
      [owner,kind,key,district]), error => error.code === '23514' || /check constraint/i.test(error.message));
  }
  assert.equal((await ownAgentCompany(pool, owner)).company.premises, null, 'Failed tuples do not mutate valid empty premises');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_treasuries')).rows[0].count), 0, 'Metadata requires no funded treasury');
  await rejects(setAgentCompany(pool, owner, body(0)), 'revision');
  await rejects(setAgentCompany(pool, 'missing-owner', body(0)), 'not_found');
  for (const bad of [{ ...body(1), owner: rival }, { ...body(1), name: '<script>' }, { ...body(1), name: 'x' },
    { ...body(1), name: 'private\nname' }, { ...body(1), published: 'true' }, { ...body(1), premises: 'controller' },
    { ...body(1), expectedRevision: 2147483647 }, { name: 'Company', published: true, premises: null }]) await rejects(setAgentCompany(pool, owner, bad), 'terms');
  await rejects(setAgentCompany(pool, owner, body(1, 'estate')), 'premises');
  await pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)', [owner]);
  let current = await setAgentCompany(pool, owner, body(1, 'estate'));
  assert.deepEqual(current.company.premises, { kind: 'estate', verified: true, tier: 1 });
  await pool.query('UPDATE estates SET tier=0 WHERE account_id=$1', [owner]);
  assert.deepEqual((await getAgentCompany(pool, owner)).company.premises, { kind: 'estate', verified: false });
  await pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district,controller_account) VALUES($1,$2,$3,$4,$5)', [rival, 'PRIVATE_RIVAL_DEED', 'private_rival_deed', 'docks', owner]);
  await rejects(setAgentCompany(pool, owner, body(2, 'street')), 'premises');
  await pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,$2,$3,$4)', [owner, 'PRIVATE_OWN_DEED', 'private_own_deed', 'docks']);
  current = await setAgentCompany(pool, owner, body(2, 'street'));
  assert.deepEqual(current.company.premises, { kind: 'street', verified: true, district: 'docks' });
  assert(!JSON.stringify(current).includes('PRIVATE_')); assert(!JSON.stringify(current).includes('name_lc'));
  await pool.query('UPDATE street_deeds SET name_lc=$2,name=$3 WHERE account_id=$1', [owner, 'replacement_same_district', 'PRIVATE_REPLACEMENT']);
  assert.deepEqual((await getAgentCompany(pool, owner)).company.premises, { kind: 'street', verified: false });
  current = await setAgentCompany(pool, owner, body(3, 'street'));
  assert.equal(current.company.premises.verified, true, 'Owner explicitly rebinds replacement deed');
  await pool.query('UPDATE street_deeds SET onchain_token_id=$2 WHERE account_id=$1', [owner, '123']);
  assert.deepEqual((await getAgentCompany(pool, owner)).company.premises, { kind: 'street', verified: false });
  await rejects(setAgentCompany(pool, owner, body(4, 'street')), 'premises');
  await pool.query('DELETE FROM street_deeds WHERE account_id=$1', [rival]);
  await pool.query('UPDATE street_deeds SET account_id=$2,onchain_token_id=NULL WHERE account_id=$1', [owner, rival]);
  assert.deepEqual((await getAgentCompany(pool, owner)).company.premises, { kind: 'street', verified: false });
  current = await setAgentCompany(pool, owner, body(4, null, false));
  assert.equal(current.company.revision, 5); assert.equal(current.company.premises, null);
  await rejects(getAgentCompany(pool, owner), 'not_found');
  assert.equal(await publicAgentCompany(pool, owner), null);
  assert.equal((await ownAgentCompany(pool, owner)).company.published, false);
  await setAgentCompany(pool, rival, body(0));
  assert.equal((await getAgentCompany(pool, rival)).company.name, initial.company.name, 'Company names do not confer a scarce global claim');
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => reply.code(error.code === 'resource_owner_authority' ? 403 : error.code === 'resource_not_found' ? 404 : 400).send({ error: error.code }));
  registerResources(app, { pool, auth: async (request, reply) => {
    if (!['Bearer owner','Bearer agent'].includes(request.headers.authorization)) return reply.code(401).send({ error: 'unauthorized' });
    request.user = { sub: owner, agent: request.headers.authorization === 'Bearer agent' };
  }, modAuth: async (_request, reply) => reply.code(403).send({ error: 'forbidden' }) });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources/company' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/resources/company', headers: { authorization: 'Bearer agent' }, payload: body(5) })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/resources/company', headers: { authorization: 'Bearer owner' }, payload: { ...body(5), accountId: rival } })).statusCode, 400);
    assert.equal((await ownAgentCompany(pool, owner)).company.revision, 5, 'Forged owner terms cannot mutate profiles');
    const read = await app.inject({ method: 'GET', url: '/v1/resources/company', headers: { authorization: 'Bearer agent' } });
    assert.equal(read.statusCode, 200); assert.equal(read.json().company.accountId, owner);
    assert.equal((await app.inject({ method: 'GET', url: `/v1/resources/companies/${owner}` })).statusCode, 404);
    const publish = await app.inject({ method: 'POST', url: '/v1/resources/company', headers: { authorization: 'Bearer owner' }, payload: body(5) });
    assert.equal(publish.statusCode, 200); assert.equal(publish.json().company.revision, 6);
    assert.equal((await app.inject({ method: 'GET', url: `/v1/resources/companies/${owner}` })).statusCode, 200);
  } finally { await app.close(); }
  if (postgres) {
    const writers = await Promise.allSettled([setAgentCompany(pool, owner, { ...body(6), name: 'Writer One' }), setAgentCompany(pool, owner, { ...body(6), name: 'Writer Two' })]);
    assert.equal(writers.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(writers.filter(row => row.status === 'rejected' && row.reason.code === 'resource_revision').length, 1);
  }
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_treasuries')).rows[0].count), 0);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_ledger')).rows[0].count), 0);
  console.log(`agentcompany PASS (${postgres ? 'PostgreSQL' : 'memory'}) owner CAS, premises identity verification, privacy and metadata-only authority`);
} finally {
  if (oldIntake === undefined) delete process.env.RESOURCE_ECONOMY; else process.env.RESOURCE_ECONOMY = oldIntake;
  await database.cleanup(pool);
}
