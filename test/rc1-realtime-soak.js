// Socket/driver controls only. This fixture is not an OMERTA/native qualification.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSoakHttpClient, enterSoakActors, nextSoakRequest, createSoakMeasurements, runSoakTraffic } from '../tools/rc1-realtime-soak.js';
import { localSoakEnvironmentValues, createLocalSoakEnvironment, localSoakFaultPlan } from '../tools/rc1-realtime-soak-local.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const recorder = () => ({ events: [], artifacts: new Map(),
  async record(event) { this.events.push(structuredClone(event)); },
  async artifact(name, value) { assert(!this.artifacts.has(name)); this.artifacts.set(name, structuredClone(value)); },
});
const actors = count => Array.from({ length: count }, (_, actorIndex) => ({ actorIndex, characterId: `c-${actorIndex}`, token: `private-${actorIndex}`, character: null, pending: null }));
const crimes = [{ id: 'pickpocket', lvl: 1, nerve: 1 }];
const character = { level: 1, nerve: 10, jailSeconds: 0 };
async function withServer(handler, work, options = {}) {
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    await handler(request, response, body ? JSON.parse(body) : null);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = createSoakHttpClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, maxInflight: 100, timeoutMs: 1000, ...options });
  try { await work(client); }
  finally { client.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const send = (response, value, status = 200) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); };
let passed = 0;

// Ordinary entry binds durable credentials before creating identities; history
// excludes bearer/recovery secrets while private artifacts retain recovery data.
await withServer(async (req, res, body) => {
  assert(['POST /v1/auth/guest', 'POST /v1/character'].includes(`${req.method} ${req.url}`));
  if (req.url.endsWith('/guest')) { assert(body.bootstrapSecret.length >= 32); assert.equal(body.inviteCode, 'already-issued'); send(res, { token: `token-${body.bootstrapSecret}` }); }
  else { assert(req.headers.authorization.startsWith('Bearer token-')); assert(req.headers['idempotency-key']); send(res, { id: `character-${body.name}` }); }
}, async client => {
  const proof = recorder(), roster = await enterSoakActors({ admissions: [{ name: 'Soak One', inviteCode: 'already-issued' }, { name: 'Soak Two', inviteCode: 'already-issued' }], client, recorder: proof, spacingMs: 0 });
  assert.equal(roster.length, 2); assert.equal(proof.artifacts.size, 3);
  const history = JSON.stringify(proof.events);
  assert(!history.includes('token-')); assert(!history.includes('bootstrapSecret')); assert(!history.includes('already-issued'));
  assert.equal(proof.events.filter(event => event.kind === 'soak-entry-character').length, 2); passed++;
});

await withServer(async (_req, res) => send(res, { error: 'invite' }, 403), async client => {
  const proof = recorder();
  await assert.rejects(enterSoakActors({ admissions: [{ name: 'Denied' }], client, recorder: proof, spacingMs: 0 }), /admission failed/);
  assert.equal(proof.events.length, 1); assert.equal(proof.artifacts.size, 1); passed++;
});

// Hold all real sockets on the server until the complete burst arrives. Neither
// a barrier inside a callback nor queued work counts as network concurrency.
{
  const waiting = [];
  await withServer(async (_req, res) => { waiting.push(res); if (waiting.length === 100) for (const response of waiting) send(response, { ok: true }); }, async client => {
    const results = await Promise.all(Array.from({ length: 100 }, () => client.request({ path: '/v1/me' })));
    assert.equal(client.maxWireInflight, 100); assert(results.every(result => result.status === 200 && result.sentAtMs !== null)); passed++;
  });
}

// Open-loop arrivals continue while capacity is occupied, and all queued work is
// retained and drained. End-to-end latency includes that measured queue.
await withServer(async (_req, res) => { await sleep(16); send(res, { character }); }, async client => {
  const proof = recorder();
  const result = await runSoakTraffic({ actors: actors(3), publicCrimes: crimes, client, recorder: proof,
    durationMs: 90, arrivalsPerSecond: 200, maxInflight: 2, maxQueued: 50, burstSize: 2, seed: 'queue',
    requiredFaults: ['server restart'] });
  assert.equal(result.metrics.arrivalRate.count, 20); assert.equal(result.metrics.completedRate.count, 20);
  assert(result.metrics.maxQueue > 2); assert.equal(result.metrics.maxInflight, 2);
  assert(result.metrics.queueTime.maxMs > 10); assert(result.metrics.commandP95Ms >= result.metrics.transportLatency.commandP95Ms);
  assert(result.metrics.participatingActors > 0); assert.equal(result.faults[0].status, 'NOT_EXECUTED');
  assert.equal(result.faultCasesComplete, false); assert.equal(result.backlogRecoveryPassed, false);
  assert(!JSON.stringify(proof.events).includes('private-')); assert(!proof.events.some(event => 'sequence' in event)); passed++;
});

// A committed-but-disconnected POST cannot be replaced with a new command/key.
{
  const seenKeys = [], committed = new Set(); let failed = false, deniedRetry = false;
  await withServer(async (req, res) => {
    if (req.method === 'GET') { send(res, { character }); return; }
    const key = req.headers['idempotency-key']; seenKeys.push(key);
    if (!failed) { failed = true; committed.add(key); req.socket.destroy(); return; }
    if (!deniedRetry) { deniedRetry = true; send(res, { error: 'rate_limited' }, 429); return; }
    committed.add(key); send(res, { character, ok: true });
  }, async client => {
    const proof = recorder(), roster = actors(1);
    const result = await runSoakTraffic({ actors: roster, publicCrimes: crimes, client, recorder: proof,
      durationMs: 100, arrivalsPerSecond: 80, maxInflight: 1, maxQueued: 30, burstSize: 1, seed: 'retry' });
    assert(seenKeys.length >= 3); assert.equal(seenKeys[0], seenKeys[1]); assert.equal(seenKeys[1], seenKeys[2]);
    assert.equal(committed.size, new Set(seenKeys).size); assert.equal(result.unresolvedCommands.length, 0);
    assert(result.metrics.unexpectedFailures >= 1); passed++;
  });
}

await withServer(async (_req, res) => { await sleep(30); send(res, { character }); }, async client => {
  const proof = recorder();
  const result = await runSoakTraffic({ actors: actors(2), publicCrimes: crimes, client, recorder: proof,
    durationMs: 60, arrivalsPerSecond: 1000, maxInflight: 1, maxQueued: 1, burstSize: 1, seed: 'overflow' });
  assert.match(result.failure.message, /queue exceeded/); assert(result.metrics.arrivalRate.count > result.metrics.completedRate.count); passed++;
});

// A control can perform a genuine connection interruption and retain its result;
// even a returned "passed" flag cannot grant fault or backlog qualification.
await withServer(async (_req, res) => { await sleep(12); if (!res.destroyed) send(res, { character }); }, async client => {
  const proof = recorder();
  const result = await runSoakTraffic({ actors: actors(3), publicCrimes: crimes, client, recorder: proof,
    durationMs: 100, arrivalsPerSecond: 40, maxInflight: 3, maxQueued: 30, burstSize: 3, seed: 'fault',
    requiredFaults: ['reconnect storm', 'worker interruption'], faults: [{ kind: 'reconnect storm', atMs: 0,
      run: async ({ client }) => { const generation = client.reconnect(); await sleep(25); return { generation, passed: true }; } }] });
  assert.equal(result.faults[0].status, 'EXECUTED_UNVERIFIED'); assert.equal(result.faults[1].status, 'NOT_EXECUTED');
  assert.equal(result.faultCasesComplete, false); assert.equal(result.backlogRecoveryPassed, false);
  assert(result.metrics.injectedFaultFailures > 0); assert.equal(result.metrics.unexpectedFailures, 0); passed++;
});

// Read-only backend-observation failure is retained, never silently erased.
await withServer(async (_req, res) => send(res, { character }), async client => {
  const proof = recorder();
  const result = await runSoakTraffic({ actors: actors(1), publicCrimes: crimes, client, recorder: proof,
    durationMs: 45, arrivalsPerSecond: 20, maxInflight: 1, maxQueued: 10, burstSize: 1, seed: 'observe', observationEveryMs: 10,
    observe: async () => { throw Object.assign(new Error('database reconnect'), { code: 'CONNECTION' }); } });
  assert(result.backendObservationFailures.length > 0); assert(proof.events.some(row => row.kind === 'soak-backend-observation-failure')); passed++;
});

{
  const roster = actors(1), actor = roster[0]; actor.character = { ...character, jailSeconds: 1 };
  assert.equal(nextSoakRequest(actor, crimes, 'jailed', 0).method, 'GET');
  actor.character = character; const first = nextSoakRequest(actor, crimes, 'retry', 1), retry = nextSoakRequest(actor, crimes, 'retry', 2);
  assert.equal(first.idempotencyKey, retry.idempotencyKey); assert.equal(retry.retry, true);
  const measurements = createSoakMeasurements({ actors: roster, durationMs: 2 * 3600000, faults: [] });
  const sample = (completedMs, method, status, retry = false) => ({ actorIndex: 0, request: { method, retry }, intendedMs: completedMs - 12,
    dispatchedMs: completedMs - 2, completedMs, response: { status, latencyMs: 2, body: { error: 'nerve' } } });
  measurements.observe(sample(1, 'GET', 200)); measurements.observe(sample(5, 'POST', 400)); measurements.observe(sample(20, 'POST', 200, true));
  measurements.observe(sample(3600001, 'POST', 200));
  const metrics = measurements.summary({ arrivalCount: 4, elapsedMs: 7200000, maxInflight: 100, maxWireInflight: 1, maxQueue: 1 });
  assert.equal(metrics.participatingActors, 1); assert.equal(metrics.minActiveActorsPerHour, 0);
  assert.deepEqual(metrics.activeActorsByHour.map(hour => hour.actors), [0, 1]); assert.equal(metrics.intendedDenials['400:nerve'], 1);
  assert.equal(metrics.commandP95Ms, 12); assert.equal(metrics.transportLatency.commandP95Ms, 2); passed++;
  assert.equal(metrics.maxInflight, 1); assert.equal(metrics.maxPendingHttp, 100);
}

await withServer(async (_req, res) => { await sleep(40); if (!res.destroyed) send(res, { ok: true }); }, async client => {
  const result = await client.request({ path: '/v1/me' }); assert.equal(result.status, null); assert.equal(result.error.code, 'SOAK_TIMEOUT'); passed++;
}, { timeoutMs: 5 });
assert.throws(() => createSoakHttpClient({ baseUrl: 'https://secret@example.com', maxInflight: 1 }));
{
  const values = { databaseUrl: 'postgres://postgres@127.0.0.1/rc1_world_000000000000000000000000', port: 49999,
    secrets: { JWT_SECRET: 'a'.repeat(32), MARKET_SEED: 'b'.repeat(32), MOD_KEY: 'c'.repeat(32) } };
  const env = localSoakEnvironmentValues(values);
  assert.equal(env.RATE_LIMIT, 'on'); assert.equal(env.INVITE_MODE, 'on'); assert.equal(env.NODE_ENV, 'production');
  for (const settings of [{ RATE_LIMIT: 'off' }, { CHAIN_RPC_URL: 'http://production.invalid' }, { CAR_THEFT_P: '1' }, { PG_LOCK_TIMEOUT_MS: '0' }])
    assert.throws(() => localSoakEnvironmentValues({ ...values, settings }));
  assert.throws(() => localSoakEnvironmentValues({ ...values, databaseUrl: 'postgres://postgres@elsewhere/production' }));
  assert.throws(() => localSoakEnvironmentValues({ ...values, secrets: { ...values.secrets, RATE_LIMIT: 'off' } }));
  assert.throws(() => localSoakFaultPlan({}, { schedule: {} })); passed++;
}
process.stdout.write(`${JSON.stringify({ status: 'PASS_SCOPED', controls: passed, scope: 'Real socket driver controls; no native game, twelve-hour soak, or production equivalence claim' })}\n`);

if (process.argv.includes('--postgres')) {
  assert(process.env.RC1_SOAK_CONTROL_URL && process.env.RC1_SOAK_OUTPUT, 'Explicit disposable control URL and fresh private output directory required');
  const source = await sourceIdentity(), directory = path.resolve(process.env.RC1_SOAK_OUTPUT), runId = path.basename(directory);
  const proof = await createProofRecorder({ directory, source, runId, seed: 'local-soak-control', scenarioId: 'realtime-soak-controls', population: 3,
    configuration: { originalEntrypoints: true, population: 3, rateLimits: 'on', acceleratedClock: false, scope: 'Bounded local fault controls, not twelve-hour qualification' } });
  let environment, client, finished = false, cleanupAttempted = false;
  try {
    environment = await createLocalSoakEnvironment({ source, recorder: proof, runId, controlUrl: process.env.RC1_SOAK_CONTROL_URL, population: 3 });
    client = createSoakHttpClient({ baseUrl: environment.baseUrl, maxInflight: 3 });
    const roster = await enterSoakActors({ admissions: environment.admissions, client, recorder: proof, spacingMs: 1000 });
    const kinds = ['shared-object contention', 'reconnect storm', 'worker interruption', 'database reconnect', 'server restart'];
    const plan = localSoakFaultPlan(environment, { schedule: Object.fromEntries(kinds.map(kind => [kind, 0])), reconnectActors: 2, pauseMs: 100 });
    const results = [];
    for (const fault of plan) results.push(await proof.invoke('local-original-fault-control', { kind: fault.kind }, () => fault.run({ actors: roster, client, recorder: proof })));
    assert.equal(results[0].intervention.freshSales, 1); assert.equal(results[1].intervention.successful, 2);
    assert.notEqual(results[2].intervention.stopped.pid, results[2].intervention.restarted.pid);
    assert(results[3].intervention.results.some(row => row.result.some(value => value.terminated === true)));
    assert.notEqual(results[4].intervention.stopped.pid, results[4].intervention.restarted.pid);
    await proof.artifact('local-fault-controls.json', { results, scope: 'Actual original local processes, ordinary HTTP actors and five injected fault controls. Due-work completeness and production equivalence remain open.' });
    client.close(); cleanupAttempted = true; await environment.close(); finished = true;
    const record = await proof.finish({ status: 'PASS_SCOPED', controls: 5, faultCasesComplete: false, backlogRecoveryPassed: false, productionEquivalent: false });
    const verified = await verifyArtifactIndex(directory, record);
    await fs.writeFile(path.join(directory, 'verification.json'), JSON.stringify({ source: source.revision, verified }) + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(JSON.stringify({ status: record.status, nativeFaultControls: 5, source: source.revision, originalProcesses: true, productionEquivalent: false }) + '\n');
  } catch (error) {
    client?.close(); if (environment && !cleanupAttempted) try { cleanupAttempted = true; await environment.close(); } catch { /* cleanup artifact retains details */ }
    if (!finished) { await proof.record({ kind: 'local-soak-control-failure', error: { message: error.message, code: error.code || null } });
      await proof.finish({ status: 'FAIL', message: error.message, productionEquivalent: false }); }
    throw error;
  }
}
