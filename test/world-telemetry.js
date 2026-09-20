import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { addPlayer, commandDatabase, postgres, findCommand } from './lib/player-command-support.js';
import { recordWorldObservation, recordWorldCommand, worldReleaseMetrics, flushWorldTelemetry,
  commandConsequenceReferences } from '../src/world-telemetry.js';

process.env.MOD_KEY = 'rc1-telemetry-mod-key-long-enough-for-production';
process.env.JWT_SECRET = 'rc1-telemetry-isolated-JWT-secret-0123456789';
process.env.MARKET_SEED = 'rc1-telemetry-isolated-market-seed-0123456789';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RATE_LIMIT = 'on';
process.env.CORE_PROGRESSION = 'on';
for (const flag of ['WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
process.env.COORDINATION_ACCOUNT_IDS = 'rc1-observer';
const database = postgres ? await commandDatabase('world_telemetry') : null;
if (database) {
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  endpoint.searchParams.set('options', database.pool.options.options);
  process.env.DATABASE_URL = endpoint.toString();
}
const app = await buildServer();
try {
  await addPlayer(app.pool, 'rc1-observer');
  await addPlayer(app.pool, 'rc1-outside');
  const token = app.jwt.sign({ sub: 'rc1-observer', tv: 0 });
  const headers = { authorization: `Bearer ${token}` };
  const observe = (payload, authorized = true) => app.inject({ method: 'POST', url: '/v1/commands/observations', headers: authorized ? headers : {}, payload });
  const initialTime = Date.now() - 33 * 60000, seen = new Set(); let sequence = 0;
  const stamp = async (at = null) => {
    await flushWorldTelemetry(app.pool);
    for (const row of (await app.pool.query("SELECT id FROM telemetry WHERE event IN ('world_view','world_command') ORDER BY at,id")).rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      await app.pool.query('UPDATE telemetry SET at=$2 WHERE id=$1', [row.id, new Date(at ?? initialTime + ++sequence * 1000)]);
    }
  };
  assert.equal((await observe({ phase: 'session', session: 'session-one' }, false)).statusCode, 401);
  for (const payload of [{ phase: 'completed', session: 'session-one' }, { phase: 'session', session: 'session-one', accountId: 'rc1-outside' },
    { phase: 'session', session: 'session-one', count: 201 }]) assert.equal((await observe(payload)).statusCode, 400);
  for (const phase of ['session', 'command_center', 'opportunity_open', 'preparation']) {
    assert.equal((await observe({ phase, session: 'session-one', reference: 'first-known-opportunity' })).statusCode, 200);
    await stamp();
  }
  await observe({ phase: 'opportunity_open', session: 'session-one', reference: 'second-known-opportunity' }); await stamp();
  await recordWorldCommand(app.pool, 'rc1-observer', { phase: 'completed', executionId: 'test-observation-identity', replayed: false,
    consequenceReferences: ['new-visible-history'] }); await stamp();
  await recordWorldCommand(app.pool, 'rc1-observer', { phase: 'completed', executionId: 'test-observation-identity', replayed: true });
  await stamp();
  await observe({ phase: 'consequence', reference: 'unrelated-old-history', session: 'session-one' }); await stamp();
  assert.equal((await worldReleaseMetrics(app.pool)).funnel[5].accounts, 0, 'an unrelated visible history card is not a command consequence');
  await observe({ phase: 'consequence', reference: 'new-visible-history', session: 'session-one' }); await stamp();
  await observe({ phase: 'opportunity_open', reference: 'first-known-opportunity', session: 'session-one' }); await stamp();
  assert.equal((await worldReleaseMetrics(app.pool)).funnel[6].accounts, 0, 'reopening the first opportunity is not the second opportunity');
  for (const [phase, reference] of [['opportunity_open', 'second-known-opportunity']]) {
    assert.equal((await observe({ phase, reference, session: 'session-one' })).statusCode, 200);
    await stamp();
  }
  let report = await worldReleaseMetrics(app.pool);
  assert.equal(report.completedCommandIdentities, 1, 'replayed observations must not inflate completed moves');
  assert(report.funnel.slice(0, 7).every((stage) => stage.accounts === 1), JSON.stringify(report.funnel));
  assert.equal(report.funnel[7].accounts, 0, 'a reload is not retention');
  await observe({ phase: 'session', session: 'early-reload' }); await stamp(initialTime + 5 * 60000);
  assert.equal((await worldReleaseMetrics(app.pool)).funnel[7].accounts, 0, 'a new page identity within 30 minutes is not retention');
  await observe({ phase: 'session', session: 'session-one' }); await stamp(initialTime + 31 * 60000);
  assert.equal((await worldReleaseMetrics(app.pool)).funnel[7].accounts, 0, 'the original session never counts as a return because another tab existed');
  await observe({ phase: 'session', session: 'actual-return' }); await stamp(initialTime + 32 * 60000);
  assert((await worldReleaseMetrics(app.pool)).funnel.every((stage) => stage.accounts === 1), 'all eight ordered funnel stages are observable');
  const stored = (await app.pool.query("SELECT props FROM telemetry WHERE event='world_view'")).rows;
  assert(!JSON.stringify(stored).includes('first-known-opportunity'), 'store only a hashed presentation reference');
  assert.equal((await app.inject({ method: 'GET', url: '/v1/mod/release-funnel', headers })).statusCode, 401);
  const mod = await app.inject({ method: 'GET', url: '/v1/mod/release-funnel', headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(mod.statusCode, 200, mod.body);
  // Forging a view grants neither admission nor a command identity.
  const outside = app.jwt.sign({ sub: 'rc1-outside', tv: 0 });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/commands/observations', headers: { authorization: `Bearer ${outside}` },
    payload: { phase: 'opportunity_open', reference: 'hidden', session: 'spoof' } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/commands', headers: { authorization: `Bearer ${outside}` } })).statusCode, 409);
  // A telemetry database failure never changes a successful domain response.
  const failingPool = { query: async () => { throw new Error('offline'); } };
  await recordWorldCommand(failingPool, 'rc1-observer', { phase: 'completed', executionId: 'x' });
  await flushWorldTelemetry(failingPool);
  report = await worldReleaseMetrics(app.pool);
  assert.equal(report.observationWriteFailuresSinceBoot, 1);

  const action = findCommand((await app.inject({ method: 'GET', url: '/v1/commands', headers })).json(), 'mystery.start');
  await flushWorldTelemetry(app.pool);
  const originalQuery = app.pool.query.bind(app.pool); let releaseWrite;
  const blocked = new Promise((resolve) => { releaseWrite = resolve; });
  app.pool.query = (sql, ...args) => String(sql).startsWith('INSERT INTO telemetry')
    ? blocked.then(() => originalQuery(sql, ...args)) : originalQuery(sql, ...args);
  const executionId = action.executionIdentity.executionId;
  try {
    let timer;
    const response = await Promise.race([
      app.inject({ method: 'POST', url: '/v1/commands/execute', headers: { ...headers, 'idempotency-key': executionId },
        payload: { executionId, confirmed: true } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Telemetry delayed a committed command response')), 3000); }),
    ]).finally(() => clearTimeout(timer));
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().status, 'COMPLETED');
  } finally { releaseWrite(); await flushWorldTelemetry(app.pool); app.pool.query = originalQuery; }

  const flooded = [];
  for (let i = 0; i < 40; i++) flooded.push((await observe({ phase: 'command_center', session: `observation-${i}` })).statusCode);
  assert(flooded.includes(429), 'the independent observation bucket still bounds authenticated floods');
  const replayAfterObservations = await app.inject({ method: 'POST', url: '/v1/commands/execute',
    headers: { ...headers, 'idempotency-key': executionId }, payload: { executionId, confirmed: true } });
  assert.equal(replayAfterObservations.statusCode, 200, 'observation floods cannot consume the gameplay mutation allowance');
  assert.equal(replayAfterObservations.json().replayed, true);

  let releaseQueue, writes = 0;
  const queueBarrier = new Promise((resolve) => { releaseQueue = resolve; });
  const slowPool = { query: async () => { writes++; await queueBarrier; } };
  for (let i = 0; i < 200; i++) await recordWorldCommand(slowPool, 'rc1-observer', { phase: 'issued', count: 1 });
  assert.equal(writes, 1, 'only one telemetry connection can be occupied per pool');
  assert((await worldReleaseMetrics(app.pool)).observationDroppedWritesSinceBoot >= 72, 'untrusted observations cannot grow an unbounded queue');
  releaseQueue(); await flushWorldTelemetry(slowPool); assert.equal(writes, 128);

  const consequence = { id: 'new-event', subject: { id: 'changed-world' }, cause: 'You helped bring about this change.' };
  const change = { feedback: { worldChanges: [{ id: 'changed-world' }] }, projection: { consequences: [consequence] } };
  assert.deepEqual(commandConsequenceReferences(change), ['new-event']);
  assert.deepEqual(commandConsequenceReferences({ ...change, replayed: true }), []);
  assert.deepEqual(commandConsequenceReferences({ ...change, feedback: { worldChanges: [] } }), []);
  assert.deepEqual(commandConsequenceReferences({ ...change, projection: { consequences: [{ ...consequence, id: 'foreign-newest', cause: null }, consequence] } }), [],
    'a newer foreign action does not attribute an old owned consequence to this command');
  console.log(`world-telemetry: ${postgres ? 'native PostgreSQL' : 'memory'} queries, authenticated observations, moderator-only eight-stage funnel, consequence attribution, replay deduplication, queue bounds and nonblocking command outcomes passed`);
} finally { await flushWorldTelemetry(app.pool); await app.close(); if (database) await database.cleanup(database.pool); }
