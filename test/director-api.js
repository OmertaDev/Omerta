import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { register } from '../src/routes/commands.js';
import { register as registerProjections } from '../src/routes/projections.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';
import { dockFixture } from './lib/director-support.js';
import { findCommand } from './lib/player-command-support.js';

const flags = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'COORDINATION_ACCOUNT_IDS', 'LIVING_WORLD_DIRECTOR', 'DIRECTOR_ACCOUNT_IDS'];
const previous = Object.fromEntries(flags.map((name) => [name, process.env[name]]));
let fixture, app;
try {
  for (const name of flags) delete process.env[name];
  for (const name of flags.slice(0, 6)) process.env[name] = 'on';
  process.env.LIVING_WORLD_DIRECTOR = 'LIVE';
  fixture = await dockFixture('director_api');
  const { pool, content, actors } = fixture;
  await fixture.establish();
  const director = createLivingWorldDirector({ pool, content, definitions: createDockWarDefinitions(content), mode: 'LIVE' });
  const situationId = (await director.tick()).selected[0].situationId;
  app = Fastify(); await app.register(jwt, { secret: 'isolated-director-api-test-only' });
  register(app, { pool, auth: (request) => request.jwtVerify() });
  registerProjections(app, { pool, auth: (request) => request.jwtVerify(), readPlayer: async () => ({}) });
  const tokens = Object.fromEntries(Object.values(actors).map((accountId) => [accountId, app.jwt.sign({ sub: accountId })]));
  const request = (account, method, url, payload, key) => app.inject({ method, url,
    headers: { ...(account ? { authorization: `Bearer ${tokens[account]}` } : {}), ...(key ? { 'idempotency-key': key } : {}) },
    ...(payload ? { payload } : {}) });
  const view = async (account) => {
    const result = await request(account, 'GET', '/v1/commands');
    assert.equal(result.statusCode, 200, result.body); assert.equal(result.headers['cache-control'], 'no-store');
    return result.json();
  };
  assert.equal((await request(null, 'GET', '/v1/commands')).statusCode, 401);
  const hidden = await view(actors.outsider);
  assert.equal(hidden.situations.length, 0); assert(!JSON.stringify(hidden).includes(situationId));
  const boss = await view(actors.aBoss), runner = await view(actors.aRunner);
  assert(boss.situations.some((entry) => entry.id === situationId));
  assert(boss.situations.every((entry) => !Object.hasOwn(entry, 'revision')));
  assert(boss.commands.filter((entry) => entry.commandType === 'situation.act')
    .every((entry) => !Object.hasOwn(entry.parameters, 'expectedRevision')));
  const directProjection = await request(actors.aBoss, 'GET', '/v1/projections/world');
  assert.equal(directProjection.statusCode, 200, directProjection.body);
  assert(directProjection.json().situations.some((entry) => entry.id === situationId));
  assert(directProjection.json().situations.every((entry) => !Object.hasOwn(entry, 'revision')));
  assert(!JSON.stringify(runner.situations).includes('Your dock shipment needs protection'));
  for (const value of [situationId, 'forged', 'situation:dock_shortage']) {
    const probe = await request(actors.outsider, 'GET', `/v1/commands?situationId=${encodeURIComponent(value)}`);
    assert.equal(probe.statusCode, 400); assert.equal(probe.headers['cache-control'], 'no-store');
    assert.deepEqual(probe.json(), { error: 'bad_command_request', message: 'Invalid command request.' });
  }
  for (const secret of ['pressureInputs', 'definition_hash', 'consequenceContracts', 'cooldownPolicy', 'selectionWeight'])
    assert(!JSON.stringify(boss).includes(secret), secret);
  const investigate = findCommand(runner, 'situation.act', { actionId: 'investigate' });
  const executionId = investigate.executionIdentity.executionId;
  const body = { executionId, confirmed: true };
  const stolen = await request(actors.outsider, 'POST', '/v1/commands/execute', body, executionId);
  assert.equal(stolen.statusCode, 409);
  assert.deepEqual(stolen.json(), { error: 'command_unavailable', message: 'Refresh your commands before trying again.' });
  const substituted = await request(actors.aRunner, 'POST', '/v1/commands/execute', { ...body, situationId: 'forged' }, executionId);
  assert.equal(substituted.statusCode, 400);
  const resolved = await request(actors.aRunner, 'POST', '/v1/commands/execute', body, executionId);
  assert.equal(resolved.statusCode, 200, resolved.body);
  assert(resolved.json().result.instanceId);
  const replay = await request(actors.aRunner, 'POST', '/v1/commands/execute', body, executionId);
  assert.equal(replay.statusCode, 200, replay.body); assert.equal(replay.json().replayed, true);
  await pool.query("UPDATE accounts SET status='suspended' WHERE id=$1", [actors.aRunner]);
  const revoked = await request(actors.aRunner, 'POST', '/v1/commands/execute', body, executionId);
  assert.equal(revoked.statusCode, 409); assert.deepEqual(revoked.json(), stolen.json());
  console.log('director-api: authenticated composed content, per-audience DTO, no enumeration/definition leak, strict opaque dispatch, real discovery, retry and account revocation PASS');
} finally {
  if (app) await app.close();
  if (fixture) await fixture.cleanup();
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
