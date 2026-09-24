// External, wall-clock HTTP evidence driver. No server/worker startup, SQL writes,
// clock replacement, admission minting, grants, resets, or release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { canonicalJson, createProofRecorder, sourceIdentity, sha256 } from './rc1-native-proof.js';
import { choosePublicCrime } from './rc1-native-player-policy.js';
import { snapshotWorldResources, worldResourceHash } from './rc1-world-resource-observer.js';

const HOUR = 3600000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = value => sha256(canonicalJson(value));
const errorValue = error => ({ name: error.name, code: error.code || null, message: error.message });
const positive = (value, name) => assert(Number.isFinite(value) && value > 0, `${name} must be positive`);
const integer = (value, name) => assert(Number.isSafeInteger(value) && value > 0, `${name} must be a positive integer`);
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;

export function createSoakHttpClient({ baseUrl, maxInflight, timeoutMs = 30000, maximumResponseBytes = 8 * 1024 * 1024 }) {
  const base = new URL(baseUrl);
  assert(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && base.pathname === '/' && !base.search && !base.hash,
    'Use an HTTP origin without embedded credentials, path, query, or fragment');
  integer(maxInflight, 'maxInflight'); positive(timeoutMs, 'timeoutMs'); integer(maximumResponseBytes, 'maximumResponseBytes');
  const transport = base.protocol === 'https:' ? https : http;
  const makeAgent = () => new transport.Agent({ keepAlive: true, maxSockets: maxInflight, maxTotalSockets: maxInflight });
  let agent = makeAgent(), connectionGeneration = 0, wireInflight = 0, maxWireInflight = 0;
  return {
    get maxWireInflight() { return maxWireInflight; },
    reconnect() { agent.destroy(); agent = makeAgent(); return ++connectionGeneration; },
    close() { agent.destroy(); },
    request({ method = 'GET', path, body, token, idempotencyKey }) {
      assert(path.startsWith('/v1/') && !path.startsWith('//'), 'Only ordinary /v1 API paths are supported');
      assert(['GET', 'POST'].includes(method));
      const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const started = performance.now(), startedAt = new Date().toISOString(), generation = connectionGeneration;
      return new Promise(resolve => {
        let done = false, sent = false, socketAtMs = null, sentAtMs = null, firstByteAtMs = null, length = 0;
        const chunks = [], hasher = crypto.createHash('sha256');
        const finish = value => {
          if (done) return;
          done = true; clearTimeout(timer);
          if (sent) wireInflight--;
          resolve({ ...value, startedAt, completedAt: new Date().toISOString(), latencyMs: performance.now() - started,
            socketAtMs, sentAtMs, firstByteAtMs, receivedBytes: length, connectionGeneration: generation });
        };
        const request = transport.request(new URL(path, base), { method, agent, headers: {
          accept: 'application/json', ...(bytes ? { 'content-type': 'application/json', 'content-length': bytes.length } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}), ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        } }, response => {
          firstByteAtMs = performance.now() - started;
          response.on('data', chunk => {
            length += chunk.length;
            if (length > maximumResponseBytes) request.destroy(Object.assign(new Error('Response exceeded retained byte limit'), { code: 'RESPONSE_LIMIT' }));
            else { chunks.push(chunk); hasher.update(chunk); }
          });
          response.on('error', error => finish({ status: null, error: errorValue(error), body: null, responseSha256: null }));
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let body;
            try { body = raw ? JSON.parse(raw) : null; }
            catch { body = { nonJsonResponse: raw }; }
            finish({ status: response.statusCode, body, responseSha256: hasher.digest('hex'), error: null });
          });
        });
        const timer = setTimeout(() => request.destroy(Object.assign(new Error('HTTP deadline exceeded'), { code: 'SOAK_TIMEOUT' })), timeoutMs);
        request.on('socket', () => { socketAtMs = performance.now() - started; });
        request.on('finish', () => {
          if (done) return;
          sent = true; sentAtMs = performance.now() - started;
          wireInflight++; maxWireInflight = Math.max(maxWireInflight, wireInflight);
        });
        request.on('error', error => finish({ status: null, error: errorValue(error), body: null, responseSha256: null }));
        request.end(bytes);
      });
    },
  };
}

// Persist recovery credentials before admitting anyone. Auth tokens are kept in
// restricted artifacts, never in the request history or the public run summary.
export async function enterSoakActors({ admissions, client, recorder, spacingMs = 1000 }) {
  assert(Array.isArray(admissions) && admissions.length > 0); assert(Number.isFinite(spacingMs) && spacingMs >= 0);
  assert.equal(new Set(admissions.map(row => row.name)).size, admissions.length, 'Actor names must be unique');
  const entries = admissions.map(({ name, inviteCode = null, bootstrapSecret = crypto.randomBytes(32).toString('base64url') }, index) => {
    assert(typeof name === 'string' && /^[\w .,'&-]{2,24}$/.test(name));
    assert(typeof bootstrapSecret === 'string' && /^[A-Za-z0-9_-]{43}$/.test(bootstrapSecret)
      && Buffer.from(bootstrapSecret, 'base64url').length === 32 && Buffer.from(bootstrapSecret, 'base64url').toString('base64url') === bootstrapSecret,
    'Use the canonical 32-byte base64url guest bootstrap credential');
    return { index, name, inviteCode, bootstrapSecret };
  });
  assert.equal(new Set(entries.map(row => row.bootstrapSecret)).size, entries.length, 'Recovery credentials must be distinct');
  await recorder.artifact('soak-admissions.json', entries);
  const actors = [];
  for (const entry of entries) {
    if (actors.length) await delay(spacingMs);
    const auth = await client.request({ method: 'POST', path: '/v1/auth/guest',
      body: { bootstrapSecret: entry.bootstrapSecret, ...(entry.inviteCode ? { inviteCode: entry.inviteCode } : {}) } });
    await recorder.record({ kind: 'soak-entry-auth', actorIndex: entry.index, status: auth.status, error: auth.error,
      denialCode: typeof auth.body?.error === 'string' && /^[a-z0-9_:-]{1,80}$/.test(auth.body.error) ? auth.body.error : null,
      responseSha256: auth.responseSha256, startedAt: auth.startedAt, completedAt: auth.completedAt, latencyMs: auth.latencyMs });
    assert(auth.status >= 200 && auth.status < 300 && typeof auth.body?.token === 'string', `Ordinary admission failed for actor ${entry.index}`);
    const token = auth.body.token, idempotencyKey = crypto.randomUUID();
    await recorder.artifact(`actor-${entry.index}-credential.json`, { ...entry, token, characterIdempotencyKey: idempotencyKey });
    const created = await client.request({ method: 'POST', path: '/v1/character', token, idempotencyKey, body: { name: entry.name } });
    await recorder.record({ kind: 'soak-entry-character', actorIndex: entry.index, idempotencyKey, response: created });
    assert(created.status >= 200 && created.status < 300 && typeof created.body?.id === 'string', `Ordinary character creation failed for actor ${entry.index}`);
    actors.push({ actorIndex: entry.index, characterId: created.body.id, token, character: null, pending: null });
  }
  assert.equal(new Set(actors.map(actor => actor.characterId)).size, actors.length, 'Entry must produce distinct characters');
  return actors;
}

export function nextSoakRequest(actor, publicCrimes, seed, action) {
  // An ambiguous mutation is retried verbatim with its original idempotency key.
  if (actor.pending) return { ...actor.pending, retry: true };
  const crime = actor.character && choosePublicCrime(actor.character, publicCrimes,
    { seed, accountId: actor.characterId, day: Math.floor(Date.now() / 86400000), action });
  if (!crime) return { method: 'GET', path: '/v1/me', retry: false };
  const request = { method: 'POST', path: `/v1/crimes/${encodeURIComponent(crime.id)}`, body: {}, idempotencyKey: crypto.randomUUID(), retry: false };
  actor.pending = request;
  return request;
}

export function createSoakMeasurements({ actors, durationMs, faults }) {
  // History owns request bodies/results. Retain only numeric percentile samples,
  // bounded per-hour actor sets and counter keys in driver memory.
  const hours = Array.from({ length: Math.ceil(durationMs / HOUR) }, (_, hour) => ({ hour, actors: new Set() }));
  const participated = new Set(), reads = [], commands = [], readWire = [], commandWire = [], queued = [];
  const statuses = {}, faultStatuses = {}, denials = {};
  let completed = 0, baseline = 0, failed = 0, faultFailed = 0, maximumQueueMs = 0;
  return {
    observe(row) {
      const fault = faults.some(value => value.startedMs !== null && row.dispatchedMs <= (value.endedMs ?? row.completedMs) && row.completedMs >= value.startedMs);
      const response = row.response, command = row.request.method === 'POST', queueMs = row.dispatchedMs - row.intendedMs;
      queued.push(queueMs); maximumQueueMs = Math.max(maximumQueueMs, queueMs);
      if (response.status !== null) completed++;
      const failure = response.status === null || response.status >= 500;
      const counters = fault ? faultStatuses : statuses, key = `${response.status ?? response.error?.code ?? 'NETWORK'}`;
      counters[key] = (counters[key] || 0) + 1;
      if (fault) faultFailed += Number(failure);
      else {
        baseline++; failed += Number(failure);
        (command ? commands : reads).push(row.completedMs - row.intendedMs);
        (command ? commandWire : readWire).push(response.latencyMs);
        if (response.status >= 400 && response.status < 500) {
          const denial = `${response.status}:${response.body?.error?.code ?? response.body?.code ?? (typeof response.body?.error === 'string' ? response.body.error : 'unspecified')}`;
          denials[denial] = (denials[denial] || 0) + 1;
        }
      }
      if (command && response.status >= 200 && response.status < 300 && !row.request.retry && row.completedMs < durationMs) {
        hours[Math.floor(row.completedMs / HOUR)].actors.add(row.actorIndex); participated.add(row.actorIndex);
      }
    },
    summary({ arrivalCount, elapsedMs, maxInflight, maxWireInflight, maxQueue }) {
      return { durationHours: durationMs / HOUR, elapsedIncludingDrainMs: elapsedMs, distinctActors: actors.length,
        participatingActors: participated.size,
        participationSemantics: 'A fresh successful gameplay HTTP command completed during the measured window; entry, reads, and idempotent retries do not count.',
        activeActorsByHour: hours.map(row => ({ hour: row.hour, actors: row.actors.size, completeHour: (row.hour + 1) * HOUR <= durationMs })),
        minActiveActorsPerHour: hours.length ? Math.min(...hours.map(row => row.actors.size)) : 0,
        maxInflight: maxWireInflight, maxWireInflight, maxPendingHttp: maxInflight, maxQueue,
        inflightSemantics: 'Requests whose bytes were sent and whose response/error has not completed; excludes unsent socket and application queues.',
        readP95Ms: percentile(reads, .95), commandP95Ms: percentile(commands, .95), commandP99Ms: percentile(commands, .99),
        latencySemantics: 'Intended arrival to completed response, including generator lag and queue time. HTTP transport latency is also retained separately.',
        transportLatency: { readP95Ms: percentile(readWire, .95), commandP95Ms: percentile(commandWire, .95), commandP99Ms: percentile(commandWire, .99) },
        unexpectedFailureRate: baseline ? failed / baseline : null,
        unexpectedFailures: failed, outsideFaultRequests: baseline, injectedFaultFailures: faultFailed,
        responseCounters: statuses, injectedFaultResponseCounters: faultStatuses, intendedDenials: denials,
        denialSemantics: 'HTTP 4xx retained separately; intent must be reviewed against the recorded player request and response.',
        arrivalRate: { intendedPerSecond: arrivalCount / (durationMs / 1000), count: arrivalCount, windowMs: durationMs },
        queueTime: { p95Ms: percentile(queued, .95), maxMs: queued.length ? maximumQueueMs : null },
        completedRate: { count: completed, elapsedMs, perSecond: completed / (elapsedMs / 1000) },
        externalWalletProvider: { requests: 0, timeMs: 0, scope: 'No wallet/provider routes in this actor policy' },
      };
    },
  };
}

// Arrival times do not wait for HTTP completions. Capacity and per-actor ordering
// create a measured queue; overflowing its explicit safety bound fails the run.
export async function runSoakTraffic({ actors, publicCrimes, client, recorder, durationMs, arrivalsPerSecond, maxInflight,
  maxQueued, burstSize, seed, faults = [], requiredFaults = [], observe = null, observationEveryMs = HOUR }) {
  positive(durationMs, 'durationMs'); positive(arrivalsPerSecond, 'arrivalsPerSecond'); integer(maxInflight, 'maxInflight');
  integer(maxQueued, 'maxQueued'); integer(burstSize, 'burstSize'); positive(observationEveryMs, 'observationEveryMs');
  assert(burstSize <= actors.length && burstSize <= maxInflight && burstSize <= maxQueued);
  assert.equal(new Set(actors.map(actor => actor.actorIndex)).size, actors.length);
  assert.equal(new Set(faults.map(fault => fault.kind)).size, faults.length, 'One explicitly scheduled exercise per fault kind');
  for (const fault of faults) { assert(requiredFaults.includes(fault.kind)); assert(fault.atMs >= 0 && fault.atMs < durationMs); assert(typeof fault.run === 'function'); }
  const started = performance.now(), startWall = new Date().toISOString(), queue = [], busy = new Set();
  const faultRows = requiredFaults.map(kind => ({ kind, status: 'NOT_EXECUTED', startedMs: null, endedMs: null, evidence: null }));
  const measurements = createSoakMeasurements({ actors, durationMs, faults: faultRows });
  let arrivalCount = 0;
  let inflight = 0, peak = 0, maxQueue = 0, nextArrival = 0, nextObservation = observationEveryMs, observePending = null, fatal = null;
  const backendObservationFailures = [];
  const pending = new Set(), elapsed = () => performance.now() - started;
  const record = event => { const write = recorder.record(event); write.catch(error => { fatal ||= error; }); return write; };
  const launch = job => {
    const actor = actors[job.actorOffset], request = nextSoakRequest(actor, publicCrimes, seed, job.requestIndex);
    busy.add(actor.actorIndex); inflight++; peak = Math.max(peak, inflight);
    const dispatchedMs = elapsed();
    record({ kind: 'soak-http-dispatch', ...job, actorIndex: actor.actorIndex, dispatchedMs, request });
    const work = client.request({ ...request, token: actor.token }).then(response => {
      const row = { ...job, actorIndex: actor.actorIndex, dispatchedMs, completedMs: elapsed(), request, response };
      measurements.observe(row);
      // A rate/auth denial can happen before idempotency lookup. It cannot
      // resolve an earlier ambiguous POST; retain that key until success.
      if (request.method === 'POST' && response.status !== null && response.status < 500
        && (!request.retry || response.status >= 200 && response.status < 300)) actor.pending = null;
      // Every command consumes its prior view; a fresh player read follows even a denial.
      actor.character = request.method === 'GET' && response.status >= 200 && response.status < 300 ? response.body?.character ?? null : null;
      return record({ kind: 'soak-http-completion', ...row });
    }).catch(error => { fatal ||= error; }).finally(() => { inflight--; busy.delete(actor.actorIndex); pending.delete(work); });
    pending.add(work);
  };
  const pump = () => {
    while (inflight < maxInflight) {
      const index = queue.findIndex(job => !busy.has(actors[job.actorOffset].actorIndex));
      if (index < 0) break;
      launch(queue.splice(index, 1)[0]);
    }
  };
  const enqueue = intendedMs => {
    const requestIndex = arrivalCount++, job = { requestIndex, actorOffset: requestIndex % actors.length, intendedMs, enqueuedMs: elapsed() };
    record({ kind: 'soak-http-arrival', ...job });
    if (queue.length >= maxQueued) { fatal ||= new Error('Measured arrival queue exceeded maxQueued; no scheduled work may be silently dropped'); return; }
    queue.push(job); maxQueue = Math.max(maxQueue, queue.length); pump();
  };
  const interventions = faults.map(plan => ({ ...plan, launched: false }));
  await record({ kind: 'soak-traffic-start', startedAt: startWall, durationMs, arrivalsPerSecond, burstSize, maxInflight, maxQueued });
  for (let index = 0; index < burstSize; index++) enqueue(0);
  while (elapsed() < durationMs && !fatal) {
    const now = elapsed();
    while (nextArrival < durationMs && nextArrival <= now && !fatal) { enqueue(nextArrival); nextArrival += 1000 / arrivalsPerSecond; }
    for (const plan of interventions) if (!plan.launched && now >= plan.atMs) {
      plan.launched = true;
      const row = faultRows.find(value => value.kind === plan.kind); row.startedMs = elapsed(); row.status = 'EXECUTING';
      record({ kind: 'soak-fault-start', fault: { ...row } });
      const work = Promise.resolve().then(() => plan.run({ client, actors, recorder })).then(evidence => {
        row.evidence = evidence ?? null; row.status = 'EXECUTED_UNVERIFIED';
      }).catch(error => { row.status = 'FAILED'; row.evidence = errorValue(error); }).finally(async () => {
        row.endedMs = elapsed();
        try { await record({ kind: 'soak-fault-completion', fault: { ...row } }); }
        catch (error) { fatal ||= error; }
        finally { pending.delete(work); }
      });
      pending.add(work);
    }
    if (observe && now >= nextObservation && !observePending) {
      const observationIndex = Math.floor(nextObservation / observationEveryMs); nextObservation += observationEveryMs;
      observePending = Promise.resolve().then(() => observe(observationIndex)).catch(error => {
        backendObservationFailures.push({ observationIndex, error: errorValue(error) });
        record({ kind: 'soak-backend-observation-failure', observationIndex, error: errorValue(error) });
      }).finally(() => { observePending = null; });
    }
    pump(); await delay(Math.min(10, Math.max(1, durationMs - elapsed())));
  }
  // Timers may wake slightly late: retain every scheduled arrival before the end.
  while (nextArrival < durationMs && !fatal) { enqueue(nextArrival); nextArrival += 1000 / arrivalsPerSecond; }
  while (queue.length || pending.size) { pump(); await delay(2); }
  if (observePending) await observePending;
  const metrics = measurements.summary({ arrivalCount, elapsedMs: elapsed(), maxInflight: peak,
    maxWireInflight: client.maxWireInflight, maxQueue });
  metrics.arrivalRate.steadyPerSecond = arrivalsPerSecond; metrics.arrivalRate.initialBurst = burstSize;
  const result = { metrics, faults: faultRows, backendObservationFailures,
    unresolvedCommands: actors.filter(actor => actor.pending).map(actor => ({ actorIndex: actor.actorIndex, request: actor.pending })),
    faultCasesComplete: false, backlogRecoveryPassed: false,
    faultSemantics: 'Control execution and overlapping HTTP outcomes are evidence, not verification of original worker schedules, canonical due-work recovery, or fault coverage.',
    ...(fatal ? { failure: errorValue(fatal) } : {}) };
  await record({ kind: 'soak-traffic-end', result });
  return result;
}

export async function captureSoakBackend({ pool, recorder, label }) {
  const startedAt = new Date().toISOString(), state = await recorder.snapshot(pool, `${label}-state`);
  const resources = await snapshotWorldResources(pool);
  await recorder.artifact(`${label}-resources.json`, resources);
  const backend = (await pool.query('SELECT current_database() AS database, version() AS version, pg_postmaster_start_time() AS postmaster_started_at, clock_timestamp() AS observed_at')).rows[0];
  const heartbeat = (await pool.query('SELECT id, beat_at FROM worker_heartbeat ORDER BY id')).rows;
  const value = { label, startedAt, completedAt: new Date().toISOString(), stateSha256: state.stateSha256,
    resourceSha256: worldResourceHash(resources), resourceBoundary: resources.boundary, backend, heartbeat,
    semantics: 'Separate native read-only snapshots. Concurrent HTTP/worker changes are retained; these are not a quiescent journal, per-command reconciliation, or worker-source attestation.' };
  await recorder.record({ kind: 'soak-backend-observation', observation: value }); return value;
}

export async function runRealtimeSoak({ configuration, admissions = [], pool, faults = [], envelopeEvidence = null, prepareEnvironment = null }) {
  const source = await sourceIdentity();
  const manifestBytes = await fs.readFile('docs/release/readiness-work/scenario-manifest.json');
  const frozenBytes = await fs.readFile('docs/release/evidence/freeze/manifest.json');
  const manifest = JSON.parse(manifestBytes), criteria = { soak: manifest.thresholds.soak, load: manifest.thresholds.load };
  const { baseUrl, directory, runId, seed, durationMs, arrivalsPerSecond, maxInflight, maxQueued, burstSize,
    timeoutMs = 30000, entrySpacingMs = 1000, observationEveryMs = HOUR, historyStorage } = configuration;
  positive(durationMs, 'durationMs'); positive(arrivalsPerSecond, 'arrivalsPerSecond'); integer(maxInflight, 'maxInflight');
  integer(maxQueued, 'maxQueued'); integer(burstSize, 'burstSize'); positive(observationEveryMs, 'observationEveryMs');
  const population = prepareEnvironment ? configuration.population : admissions.length;
  integer(population, 'population'); assert(burstSize <= population && burstSize <= maxInflight && burstSize <= maxQueued);
  if (prepareEnvironment) assert(configuration.faultSchedule && typeof configuration.faultSchedule === 'object', 'Prepared environment requires an explicit fault schedule');
  assert(Number.isFinite(entrySpacingMs) && entrySpacingMs >= 0);
  const publicConfiguration = { baseUrl: baseUrl || null, runId, seed, durationMs, arrivalsPerSecond, maxInflight, maxQueued, burstSize, population,
    timeoutMs, entrySpacingMs, observationEveryMs, admissionsSha256: prepareEnvironment ? null : digest(admissions),
    environmentPreparation: prepareEnvironment ? 'Source-bound owned local environment; concrete setup artifacts precede entry' : 'External environment',
    criteria, criteriaManifestSha256: sha256(manifestBytes), historicalFreezeManifestSha256: sha256(frozenBytes),
    requestedFaults: prepareEnvironment ? configuration.faultSchedule : faults.map(({ kind, atMs }) => ({ kind, atMs })),
    deploymentEnvelope: envelopeEvidence ? { sha256: digest(envelopeEvidence), verification: 'NOT_ATTESTED' } : null };
  const recorder = await createProofRecorder({ directory, source, configuration: publicConfiguration, runId, seed,
    scenarioId: 'realtime-soak', population, ...(historyStorage ? { historyStorage } : {}) });
  let finishAttempted = false, client = null, environment = null, cleanupAttempted = false;
  try {
    if (prepareEnvironment) {
      environment = await prepareEnvironment({ source, recorder });
      ({ admissions, pool, faults } = environment); assert.equal(admissions.length, population);
      envelopeEvidence = environment.envelopeEvidence;
      await recorder.record({ kind: 'soak-owned-environment-ready', baseUrl: environment.baseUrl, admissionsSha256: digest(admissions),
        faultSchedule: faults.map(({ kind, atMs }) => ({ kind, atMs })), sourceRevision: source.revision });
    }
    client = createSoakHttpClient({ baseUrl: environment?.baseUrl || baseUrl, maxInflight, timeoutMs });
    if (envelopeEvidence) await recorder.artifact('soak-envelope-input.json', envelopeEvidence);
    await captureSoakBackend({ pool, recorder, label: 'before-entry' });
    const actors = await enterSoakActors({ admissions, client, recorder, spacingMs: entrySpacingMs });
    const rules = await client.request({ path: '/v1/rules' });
    await recorder.record({ kind: 'soak-public-rules', response: rules });
    assert.equal(rules.status, 200); assert(Array.isArray(rules.body?.crimes));
    await captureSoakBackend({ pool, recorder, label: 'before-traffic' });
    const result = await runSoakTraffic({ actors, publicCrimes: rules.body.crimes, client, recorder,
      durationMs, arrivalsPerSecond, maxInflight, maxQueued, burstSize, seed, faults, requiredFaults: criteria.soak.requiredFaults,
      observationEveryMs, observe: index => captureSoakBackend({ pool, recorder, label: `during-${index}` }) });
    await captureSoakBackend({ pool, recorder, label: 'after-traffic' });
    const status = result.failure || result.unresolvedCommands.length || result.faults.some(fault => fault.status === 'FAILED') ? 'FAIL' : 'PASS_SCOPED';
    await recorder.artifact('soak-observations.json', result);
    if (environment) { cleanupAttempted = true; await environment.close(); }
    finishAttempted = true;
    return await recorder.finish({ status, scope: 'Ordinary HTTP entry and measured wall-clock traffic with native read-only backend observations', ...result,
      matrixQualifying: false, productionEquivalent: false, originalWorkerSourceAttested: false, resourceEnvelope: null,
      remaining: ['Verify actual API/worker source and runtime configuration against this candidate',
        'Verify production-equivalent resource envelope', 'Verify every required fault and original due-work recovery within the frozen deadline',
        'Admit resource/state observations and measured results through the existing qualification verifier'] });
  } catch (error) {
    if (finishAttempted) throw error; // Never append after a final history hash or overwrite a retained failed report.
    if (environment && !cleanupAttempted) { cleanupAttempted = true; try { await environment.close(); }
      catch (cleanupError) { await recorder.record({ kind: 'soak-cleanup-failure', error: errorValue(cleanupError) }); } }
    await recorder.record({ kind: 'soak-driver-failure', error: errorValue(error) });
    await recorder.finish({ status: 'FAIL', error: errorValue(error), scope: 'Incomplete ordinary HTTP soak driver execution' });
    throw error;
  } finally { client?.close(); }
}

// A caller owns the already-running environment. DATABASE_URL is used only for
// native read-only observations; the driver never starts or modifies services.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const configuration = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  const admissions = JSON.parse(await fs.readFile(configuration.admissionsPath, 'utf8'));
  const envelopeEvidence = configuration.envelopePath ? JSON.parse(await fs.readFile(configuration.envelopePath, 'utf8')) : null;
  assert(process.env.DATABASE_URL, 'A read-only backend DATABASE_URL is required');
  const { Pool } = await import('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await runRealtimeSoak({ configuration, admissions, pool, envelopeEvidence });
    process.stdout.write(`${JSON.stringify({ status: result.status, source: result.source.revision, matrixQualifying: false })}\n`);
    if (result.status !== 'PASS_SCOPED') process.exitCode = 1;
  } finally { await pool.end(); }
}
