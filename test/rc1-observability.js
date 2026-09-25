// Gate RC1-OBS: a real HTTP command must leave one safe, correlated diagnostic chain.
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { addPlayer, findCommand } from './lib/player-command-support.js';
import { FURNACE_IDS } from '../src/content/furnace-ledger.js';
import { commandDiagnostic } from '../src/command-diagnostics.js';

assert(!process.env.DATABASE_URL, 'Use the separate PostgreSQL lane for persistence proof');
for (const flag of ['CORE_PROGRESSION','WORLD_GRAPH_KERNEL','COORDINATION_ENGINE','COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING','COORDINATION_OPERATIONS']) process.env[flag] = 'on';
const owner = 'rc1-private-account-sentinel';
process.env.COORDINATION_ACCOUNT_IDS = owner;
const app = await buildServer();
const captured = [], original = console.info;
console.info = (...args) => captured.push(args.join(' '));
try {
  await addPlayer(app.pool, owner);
  const token = app.jwt.sign({ sub: owner, tv: 0 });
  const headers = { authorization: `Bearer ${token}` };
  const snapshot = await app.inject({ method: 'GET', url: '/v1/commands', headers });
  await new Promise(setImmediate); // Fastify onResponse completes after inject resolves.
  assert.equal(snapshot.statusCode, 200, snapshot.body);
  const command = findCommand(snapshot.json(), 'mystery.start', { graphId: FURNACE_IDS.inspection });
  const executionId = command.executionIdentity.executionId;
  captured.length = 0;
  const request = { method: 'POST', url: '/v1/commands/execute',
    headers: { ...headers, 'idempotency-key': executionId, 'x-correlation-id': 'untrusted-private-value' },
    payload: { executionId, confirmed: true } };
  const response = await app.inject(request);
  await new Promise(setImmediate);
  assert.equal(response.statusCode, 200, response.body);
  const correlation = response.headers['x-correlation-id'];
  assert.match(correlation || '', /^[a-f0-9-]{36}$/, 'server-generated correlation ID is required');
  const records = captured.filter((line) => line.startsWith('{')).map((line) => JSON.parse(line))
    .filter((entry) => entry.component === 'player-command');
  assert.deepEqual(records.map((entry) => entry.phase),
    ['request', 'authorization', 'command', 'mutation', 'consequence', 'opportunity', 'response']);
  assert(records.every((entry) => entry.correlationId === correlation));
  assert(records.every((entry) => Object.keys(entry).every((key) =>
    ['component','phase','correlationId','outcome','replayed','changes','statusCode','elapsedMs'].includes(key))), 'diagnostics use a closed schema');
  const log = captured.join('\n');
  for (const secret of [owner, token, executionId, FURNACE_IDS.inspection, 'untrusted-private-value'])
    assert(!log.includes(secret), 'no identities, tokens, target IDs or caller-controlled context in diagnostics');
  captured.length = 0;
  const replay = await app.inject(request);
  await new Promise(setImmediate);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().replayed, true);
  assert(captured.some((line) => line.includes('"replayed":true')), 'replay is observable');
  // Logging is outside the domain transaction and may not convert a committed
  // response into an apparent failure even when the output surface throws.
  console.info = () => { throw new Error('unavailable log sink'); };
  commandDiagnostic('mutation', { outcome: 'completed', secret: token }, { id: correlation });
  const loggingFailure = await app.inject(request);
  await new Promise(setImmediate);
  assert.equal(loggingFailure.statusCode, 200, loggingFailure.body);
  assert.equal(loggingFailure.json().replayed, true);
  console.info = (...args) => captured.push(args.join(' '));
  captured.length = 0;
  const denied = await app.inject({ ...request, headers: { 'idempotency-key': executionId } });
  await new Promise(setImmediate);
  assert.equal(denied.statusCode, 401);
  assert.match(denied.headers['x-correlation-id'] || '', /^[a-f0-9-]{36}$/);
  assert(captured.some((line) => line.includes('"phase":"authorization"') && line.includes('"outcome":"denied"')));
  for (const [sql, status] of [
    ['UPDATE accounts SET token_version=1 WHERE id=$1', 401],
    ["UPDATE accounts SET token_version=0,status='banned' WHERE id=$1", 403],
  ]) {
    await app.pool.query(sql, [owner]); captured.length = 0;
    const directDenial = await app.inject(request); await new Promise(setImmediate);
    assert.equal(directDenial.statusCode, status);
    assert.equal(captured.filter((line) => line.includes('"phase":"authorization"') && line.includes('"outcome":"denied"')).length, 1,
      'direct revocation/banning denial is logged exactly once');
  }
  console.log('PASS RC1-OBS: request/auth/command/mutation/consequence/opportunity/response correlation, replay, denial and log privacy');
} finally {
  console.info = original;
  await app.close();
}
