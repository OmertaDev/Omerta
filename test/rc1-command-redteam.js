// RC1 gate: authoritative input and replay boundaries through the complete HTTP
// server on isolated, real PostgreSQL. Does not accept a production database.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { buildServer } from '../src/server.js';
import { addPlayer, findCommand } from './lib/player-command-support.js';
import { FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';
import { authoritativeState, roleKnowledgeProbes } from './lib/rc1-authority-probes.js';

const endpoint = new URL(process.env.RC1_TEST_DATABASE_URL || '');
assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Use an isolated loopback PostgreSQL instance');
const admin = new Pool({ connectionString: endpoint.toString() });
const database = `rc1_security_${crypto.randomBytes(8).toString('hex')}`;
await admin.query(`CREATE DATABASE ${database}`);
endpoint.pathname = `/${database}`;
process.env.DATABASE_URL = endpoint.toString();
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
  'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
for (const secret of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[secret] = crypto.randomBytes(32).toString('hex');
process.env.COORDINATION_ACCOUNT_IDS = '';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';
process.env.POPULATION_OFF = 'on';
let app;
let denials = 0;
const owner = 'rc1-security-owner', outsider = 'rc1-security-outsider';
const state = () => authoritativeState(app.pool);
const restart = async () => { await app.close(); await app.pool.end(); app = await buildServer(); };
const call = (token, payload, key, url = '/v1/commands/execute', extra = {}) => app.inject({ method: 'POST', url,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
    'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}), ...extra }, payload });
const denied = async (work, statuses) => {
  const response = await work();
  assert(statuses.includes(response.statusCode), `${response.statusCode}: ${response.body}`);
  assert.doesNotMatch(response.body, /SELECT |INSERT |UPDATE |stack|definition_json|authorization_predicate|pressureInputs/);
  denials++;
};
try {
  app = await buildServer();
  await addPlayer(app.pool, owner); await addPlayer(app.pool, outsider);
  const token = app.jwt.sign({ sub: owner, tv: 0 }), other = app.jwt.sign({ sub: outsider, tv: 0 });
  const board = await app.inject({ method: 'GET', url: '/v1/commands', headers: { authorization: `Bearer ${token}` } });
  assert.equal(board.statusCode, 200, board.body);
  const command = findCommand(board.json(), 'mystery.start', { graphId: ids.inspection });
  const key = command.executionIdentity.executionId, body = { executionId: key, confirmed: true };
  const before = await state();
  for (const extra of [
    { cost: 0 }, { costs: [] }, { cash: 1000000000 }, { rewards: { omr: 1000000000 } },
    { prerequisites: [] }, { requirements: [] }, { participants: [outsider] }, { participantIds: [outsider] },
    { targetId: outsider }, { targetIds: [outsider] }, { accountId: outsider }, { characterId: `${outsider}-character` },
    { availability: 'AVAILABLE' }, { authorization: true }, { expectedReward: 1000000000 },
    { commandType: 'world.execute' }, { parameters: { graphId: ids.inspection } },
  ]) await denied(() => call(token, { ...body, ...extra }, key), [400]);
  // Fastify's secure JSON parser rejects prototype keys before route validation;
  // the command error boundary deliberately maps that parser error to a generic refusal.
  await denied(() => call(token, { ...body, constructor: { prototype: { authorized: true } } }, key), [400, 409]);
  await denied(() => call(token, JSON.stringify(body).replace(/}$/, ',"__proto__":{"authorized":true}}'), key), [400, 409]);
  for (const value of [null, [], {}, 1, 'true'])
    await denied(() => call(token, { ...body, confirmed: value }, key), [400]);
  for (const value of [null, [], {}, 1, "' OR 1=1--", 'a'.repeat(128), key.replace('.', '..')])
    await denied(() => call(token, { ...body, executionId: value }, key), [400]);
  await denied(() => call(token, '{"executionId":', key), [400, 409]);
  await denied(() => call(token, { ...body, padding: 'x'.repeat(1024 * 1024) }, key), [400, 409, 413]);
  await denied(() => call(token, body, key, '/v1/commands/execute?accountId=other'), [400]);
  await denied(() => call(token, body, 'different-logical-request'), [400]);
  await denied(() => call(undefined, body, key), [401]);
  await denied(() => call('invalid-token', body, key), [401]);
  await denied(() => call(other, body, key), [409]);
  for (const offset of [0, 64, 65, 128]) {
    const forged = key.slice(0, offset) + (key[offset] === 'a' ? 'b' : 'a') + key.slice(offset + 1);
    await denied(() => call(token, { ...body, executionId: forged }, forged), [400, 409]);
  }
  assert.deepEqual(await state(), before, 'denied client authority claims must not change game or economic state');
  const simultaneous = await Promise.all(Array.from({ length: 8 }, () => call(token, body, key)));
  assert(simultaneous.some((r) => r.statusCode === 200));
  for (const response of simultaneous) assert([200, 409].includes(response.statusCode), response.body);
  const freshExecutions = simultaneous.filter((r) => r.statusCode === 200 && !r.json().replayed).length;
  assert.equal(freshExecutions, 1, 'only one concurrent caller may report a fresh execution');
  const complete = await call(token, body, key);
  assert.equal(complete.statusCode, 200, complete.body); assert.equal(complete.json().replayed, true);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2',
    [owner, ids.inspection])).rows[0].n), 1);
  const committed = await state();
  await restart();
  const restarted = await call(token, body, key);
  assert.equal(restarted.statusCode, 200, restarted.body); assert.equal(restarted.json().replayed, true);
  assert.deepEqual(await state(), committed, 'retry after complete server reconstruction must preserve economic state');
  const roleKnowledge = await roleKnowledgeProbes({ server: () => app, restart });
  console.log(JSON.stringify({ gate: 'RC1 command HTTP redteam', database: 'real PostgreSQL', deniedCases: denials + roleKnowledge.deniedCases,
    inputTamperingDenials: denials,
    roleKnowledge,
    concurrentRequests: simultaneous.length, concurrentStatuses: simultaneous.map((r) => r.statusCode), freshExecutions,
    uniqueMysteryInstances: 1, restartReplay: true, gameStateUnchangedOnDenialAndReplay: true, status: 'PASS' }));
} finally {
  if (app) { await app.close(); await app.pool.end(); }
  await admin.query(`DROP DATABASE ${database} WITH (FORCE)`); await admin.end();
}
