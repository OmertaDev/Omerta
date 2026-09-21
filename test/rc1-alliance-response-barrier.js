// Focused control: execute the exact runner terminal hook against a delayed original native SELECT.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256, canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'));
const output = process.env.RC1_ALLIANCE_BARRIER_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl);
const source = await sourceIdentity(), database = planOwnedWorldDatabase({ controlUrl, runId: 'alliance-response-barrier', sourceRevision: source.revision });
const runner = (await fs.readFile(new URL('./rc1-native-world-workload.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const blocks = runner.match(/      app\.addHook\('onResponse', async req => \{[\s\S]*?\n      \}\);/g);
assert.equal(blocks?.length, 1, 'Exact terminal hook not uniquely located');
// The actual recorded 48-hour runner block; a changed hook requires explicit review.
assert.equal(sha256(blocks[0]), 'e831c10a2b0cfab13526261975224a9bf35c26f0d1ecb08482879200098e9ec7');
const configuration = { scenario: 'scoped-original-http-response-completion-control',
  runnerSha256: sha256(runner), terminalHookSha256: sha256(blocks[0]), database: database.descriptor,
  control: 'Hold the exact original activity-wire SELECT before native dispatch. An ordinary eligible crime HTTP response must arrive while terminal lifecycle completion remains pending; release and await the real SELECT, then terminal hook and full invariants.',
  exclusions: ['No original worker schedule or long-horizon claim', 'No concurrent per-commit observation claim', 'No gameplay/resource fixtures or runtime changes'] };
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'alliance-response-barrier', seed: 'rc1-alpha', scenarioId: configuration.scenario, population: 1 });
const epoch = '2026-09-20T12:00:00.000Z', runtime = installSerialRuntime('rc1-alpha', epoch);
Object.assign(process.env, { DATABASE_URL: database.url, RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', POPULATION_OFF: 'on',
  LIQUIDITY_AUTOMATION_ENABLED: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const controller = createWorkerSchedule({ start: Date.parse(epoch), setClock: () => {}, expectedDormant: [] });
const namespace = 'rc1_worker_alliance_barrier_' + process.pid;
const base = new pg.Pool({ connectionString: database.url }), seam = installWorkerInstrumentation(controller, { namespace });
let app, result, release, originalQuery;
const responseCompletions = new Map(), events = [];
let sequence = 0;
const bounded = async (promise, label) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(label + ' timed out')), 10000); })]); }
  finally { clearTimeout(timer); }
};
try {
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }] = await Promise.all([import('../src/server.js'), import('../src/invariants.js')]);
  app = await buildServer();
  // Evaluate only the uniquely matched, exact hash-pinned test-harness block.
  new Function('app', 'responseCompletions', 'assert', blocks[0])(app, responseCompletions, assert);
  async function request(actor, method, path, body, key) {
    const completion = String(++sequence);
    const completed = new Promise(resolve => responseCompletions.set(completion, resolve));
    const response = await app.inject({ method, url: path, headers: { 'x-rc1-response-completion': completion,
      ...(actor ? { authorization: 'Bearer ' + actor.token } : {}), ...(key ? { 'idempotency-key': key } : {}) },
      ...(body === undefined ? {} : { payload: body }) });
    await bounded(completed, 'Setup response lifecycle'); assert.equal(response.statusCode, 200, response.body); return response.json();
  }
  const guest = await request(null, 'POST', '/v1/auth/guest', { bootstrapSecret: crypto.randomBytes(32).toString('base64url') });
  const actor = { token: guest.token, accountId: app.jwt.verify(guest.token).sub };
  const entry = await request(actor, 'POST', '/v1/character', { name: 'Response Barrier Entry' }, 'barrier-entry');
  const me = await request(actor, 'GET', '/v1/me'), rules = await request(actor, 'GET', '/v1/rules');
  const crime = rules.crimes.find(c => c.lvl <= me.character.level && c.nerve <= me.character.nerve);
  assert(crime && me.character.jailSeconds === 0);
  const initial = await runLedgerInvariants(app.pool, { alert: false }); assert(initial.ok);
  await proof.record({ kind: 'authorized-eligible-choice', accountId: actor.accountId, characterId: entry.id, me, rules, crime });
  const heldSql = 'SELECT name FROM characters WHERE account_id=$1 AND alive';
  originalQuery = app.pool.query.bind(app.pool);
  let heldResolve, nativeFinished = false, lifecycleFinished = false, heldCount = 0;
  const entered = new Promise(resolve => { heldResolve = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let actualQuery;
  app.pool.query = (sql, values) => {
    if (sql !== heldSql) return originalQuery(sql, values);
    assert.deepEqual(values, [actor.accountId]); assert.equal(++heldCount, 1, 'Unexpected additional held query');
    events.push('original-hook-select-held'); heldResolve();
    actualQuery = gate.then(() => { events.push('native-select-dispatched'); return originalQuery(sql, values); })
      .then(value => { nativeFinished = true; events.push('native-select-completed'); return value; });
    return actualQuery;
  };
  const completion = String(++sequence);
  const completed = new Promise(resolve => responseCompletions.set(completion, () => { lifecycleFinished = true; events.push('terminal-hook-completed'); resolve(); }));
  const responsePromise = app.inject({ method: 'POST', url: '/v1/crimes/' + crime.id, payload: { approach: 'standard' },
    headers: { authorization: 'Bearer ' + actor.token, 'idempotency-key': 'held-original-hook-crime', 'x-rc1-response-completion': completion } });
  await bounded(entered, 'Exact original activity SELECT');
  const response = await bounded(responsePromise, 'HTTP response before held SELECT release');
  assert.equal(response.statusCode, 200, response.body); events.push('ordinary-response-returned');
  assert.equal(nativeFinished, false); assert.equal(lifecycleFinished, false); assert.equal(responseCompletions.size, 1);
  assert.throws(() => assert(lifecycleFinished), assert.AssertionError);
  await proof.record({ kind: 'delayed-native-control-before-release', status: 'EXPECTED_INCOMPLETE', heldSql,
    heldSqlSha256: sha256(heldSql), heldCount, response: response.json(), responseReturned: true, nativeFinished, lifecycleFinished, events: [...events] });
  release(); await bounded(actualQuery, 'Actual original native SELECT'); await bounded(completed, 'Original lifecycle completion');
  assert(nativeFinished && lifecycleFinished); assert.equal(responseCompletions.size, 0); assert.equal(heldCount, 1);
  const after = await runLedgerInvariants(app.pool, { alert: false }); assert(after.ok);
  const final = await canonicalDatabaseSnapshot(app.pool); await proof.artifact('final.json', final);
  await proof.record({ kind: 'canonical-invariants', checks: after.checks });
  result = { status: 'PASS_SCOPED', ordinaryEntrants: 1, gameplayFixtures: 0, heldOriginalSelects: 1, ordinaryResponseBeforeRelease: true,
    terminalPendingBeforeRelease: true, actualOriginalSelectCompleted: true, originalLifecycleCompleted: true,
    invariants: after.checks.length, terminalHookSha256: sha256(blocks[0]), finalStateSha256: final.stateSha256, events };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack, events }; process.exitCode = 1;
  await proof.record({ kind: 'failure', ...result });
} finally {
  release?.();
  if (app && originalQuery) app.pool.query = originalQuery;
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));

