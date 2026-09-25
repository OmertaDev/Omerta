// Owned local staging controls. Original server/worker entrypoints, clocks and
// gameplay remain unchanged. No shared PostgreSQL service is stopped/restarted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { canonicalJson, sha256, assertSourceUnchanged, canonicalDatabaseSnapshot } from './rc1-native-proof.js';
import { planOwnedWorldDatabase } from './rc1-native-database.js';
import { makeInviteBatch, importBatch } from './invites.js';
import { reviewWorldBacklog } from './rc1-world-backlog-review.js';
import { runRealtimeSoak } from './rc1-realtime-soak.js';
import { collectWorldDiagnostics } from './rc1-world-diagnostics.js';
import { runLedgerInvariants } from '../src/invariants.js';

const execute = promisify(execFile), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = value => sha256(canonicalJson(value));
const safeKeys = ['PG_POOL_MAX', 'PG_STATEMENT_TIMEOUT_MS', 'PG_LOCK_TIMEOUT_MS', 'PG_IDLE_TX_TIMEOUT_MS',
  'PG_CONNECT_TIMEOUT_MS', 'PG_IDLE_TIMEOUT_MS', 'CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
  'COORDINATION_OPERATIONS', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_ACCOUNT_IDS',
  'LIVING_WORLD_DIRECTOR', 'DIRECTOR_ACCOUNT_IDS'];
const systemKeys = ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'];
const faultKinds = ['shared-object contention', 'reconnect storm', 'worker interruption', 'database reconnect', 'server restart'];
const failure = error => ({ name: error.name, message: error.message, code: error.code || null });

// Existing diagnostic helpers own their transaction boundaries. Borrow them a
// read-only savepoint inside ONE real coordinator transaction: their original
// SELECTs, SQL now(), and MVCC state are unchanged and share the same timestamp.
// Only observer transaction-control statements are adapted; application pools
// and clocks are untouched. The coordinator remains alive through every read.
export async function withSharedSoakRead(pool, work) {
  const client = await pool.connect(); let borrower = null, serial = 0;
  const controls = [], collectors = [];
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const row = (await client.query("SELECT transaction_timestamp() AS at,transaction_timestamp()::text AS exact_at,pg_current_snapshot()::text AS snapshot,pg_backend_pid() AS pid,current_setting('transaction_read_only') AS read_only,current_setting('transaction_isolation') AS isolation")).rows[0];
    assert.equal(row.read_only, 'on'); assert.equal(row.isolation, 'repeatable read');
    const logicalAt = new Date(row.at).getTime();
    const scoped = {
      query: (...args) => client.query(...args),
      async connect() {
        assert(!borrower, 'Diagnostic helpers must run serially in the shared snapshot');
        const id = ++serial, savepoint = `soak_observer_${id}`; let begun = false, released = false;
        borrower = id;
        return {
          async query(sql, ...args) {
            assert(!released); const text = typeof sql === 'string' ? sql : sql.text;
            if (/^BEGIN\b/i.test(text.trim())) {
              assert(/^BEGIN ISOLATION LEVEL REPEATABLE READ,? READ ONLY$/i.test(text.trim()), 'Unexpected observer transaction mode');
              assert(!begun); begun = true; controls.push({ borrower: id, requested: text, executed: `SAVEPOINT ${savepoint}` });
              return client.query(`SAVEPOINT ${savepoint}`);
            }
            if (/^(COMMIT|ROLLBACK)$/i.test(text.trim())) {
              assert(begun); const rollback = text.trim().toUpperCase() === 'ROLLBACK';
              if (rollback) await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
              begun = false; controls.push({ borrower: id, requested: text, executed: `${rollback ? `ROLLBACK TO SAVEPOINT ${savepoint}; ` : ''}RELEASE SAVEPOINT ${savepoint}` });
              return client.query(`RELEASE SAVEPOINT ${savepoint}`);
            }
            return client.query(sql, ...args);
          },
          release() { assert(!begun, 'Diagnostic helper released an unfinished read'); released = true; borrower = null; },
        };
      },
    };
    const collect = async (name, action) => {
      const startedAt = new Date().toISOString(); const value = await action(scoped, logicalAt);
      collectors.push({ name, startedAt, completedAt: new Date().toISOString() }); return value;
    };
    const value = await work({ pool: scoped, logicalAt, collect }); assert.equal(borrower, null);
    const after = (await client.query('SELECT transaction_timestamp()::text AS exact_at,pg_current_snapshot()::text AS snapshot')).rows[0];
    assert.equal(after.exact_at, row.exact_at); assert.equal(after.snapshot, row.snapshot);
    await client.query('COMMIT');
    return { value, binding: { kind: 'one-native-read-only-repeatable-read-transaction', logicalAt, transactionTimestamp: row.exact_at,
      databaseSnapshot: row.snapshot, backendPid: row.pid, controls, collectors,
      nonMvcc: 'Sequence counters and physical relation sizes retain their actual observed values; PostgreSQL does not make these MVCC state.' } };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function collectLocalSoakCheckpoint(pool, { sourceRevision, configuration, roster = [], actorActions = {} }) {
  const { value, binding } = await withSharedSoakRead(pool, async ({ logicalAt, collect }) => {
    const snapshot = await collect('canonical-state', q => canonicalDatabaseSnapshot(q));
    const diagnostics = await collect('world-diagnostics', q => collectWorldDiagnostics(q, { logicalAt, roster, actorActions }));
    const invariants = await collect('canonical-invariants', async q => ({ logicalAt, ...await runLedgerInvariants(q, { alert: false }) }));
    assert.equal(new Date(snapshot.capturedAt).getTime(), logicalAt);
    const backlog = reviewWorldBacklog(snapshot, { logicalAt, sourceRevision, configuration,
      lifecycleDiagnostics: diagnostics.semantic, invariants });
    return { snapshot, diagnostics, invariants, backlog };
  });
  return { ...value, binding };
}

export function localSoakEnvironmentValues({ databaseUrl, port, secrets, settings = {} }) {
  for (const key of Object.keys(settings)) assert(safeKeys.includes(key), `Unsupported local environment override: ${key}`);
  for (const [key, value] of Object.entries(settings)) if (key.startsWith('PG_')) assert(Number.isSafeInteger(Number(value)) && Number(value) > 0, `${key} must preserve a positive operational bound`);
  assert.equal(new URL(databaseUrl).hostname, '127.0.0.1'); assert(/^rc1_world_[a-f0-9]{24}$/.test(new URL(databaseUrl).pathname.slice(1)));
  assert(Number.isSafeInteger(port) && port > 0 && port <= 65535);
  assert.deepEqual(Object.keys(secrets).sort(), ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']);
  for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) assert(typeof secrets[key] === 'string' && secrets[key].length >= 32);
  return { ...Object.fromEntries(systemKeys.filter(key => process.env[key]).map(key => [key, process.env[key]])),
    NODE_ENV: 'production', RATE_LIMIT: 'on', INVITE_MODE: 'on', SOCIAL_VERIFY_MODE: 'off', TRUST_PROXY: 'off',
    DATABASE_URL: databaseUrl, PORT: String(port), ...secrets, ...settings };
}

async function freePort() {
  const server = net.createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function windowsProcess(pid) {
  assert(Number.isSafeInteger(pid) && pid > 0);
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if (!$p) { throw 'Owned process absent' }; $p | Select-Object ProcessId,ExecutablePath,CommandLine,CreationDate | ConvertTo-Json -Compress`], { windowsHide: true });
  return JSON.parse(stdout.replace(/^\uFEFF/, ''));
}
async function windowsUsage(pid) {
  assert(Number.isSafeInteger(pid) && pid > 0);
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if (!$p) { throw 'Owned process absent' }; $p | Select-Object ProcessId,WorkingSetSize,PrivatePageCount,KernelModeTime,UserModeTime,ThreadCount | ConvertTo-Json -Compress`], { windowsHide: true });
  return { sampledAt: new Date().toISOString(), ...JSON.parse(stdout.replace(/^\uFEFF/, '')) };
}
async function until(work, { timeoutMs = 60000, label, intervalMs = 50 } = {}) {
  const started = performance.now(); let last;
  do { last = await work(); if (last) return last; await sleep(intervalMs); } while (performance.now() - started < timeoutMs);
  throw new Error(`Timed out observing ${label}; no recovery result was fabricated`);
}

export async function createLocalSoakEnvironment({ source, recorder, runId, controlUrl, population = 1000,
  node = process.execPath, port = null, settings = {}, startupTimeoutMs = 60000 }) {
  assert.equal(process.platform, 'win32', 'This process-attestation implementation is scoped to Windows');
  assert(Number.isSafeInteger(population) && population > 0 && population <= 5000);
  await assertSourceUnchanged(source);
  const control = new URL(controlUrl); assert.equal(control.hostname, '127.0.0.1');
  const selectedPort = port ?? await freePort(), baseUrl = `http://127.0.0.1:${selectedPort}`;
  const secrets = Object.fromEntries(['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY'].map(key => [key, crypto.randomBytes(32).toString('hex')]));
  localSoakEnvironmentValues({ databaseUrl: 'postgres://postgres@127.0.0.1/rc1_world_000000000000000000000000', port: selectedPort, secrets, settings });
  const nodeSha256 = sha256(await fs.readFile(node)), nodeVersion = (await execute(node, ['--version'], { windowsHide: true })).stdout.trim();
  const lease = planOwnedWorldDatabase({ controlUrl, runId, sourceRevision: source.revision });
  const owned = await lease.create(), marker = JSON.parse(owned.ownerMarker), nonce = marker.nonce;
  const tag = role => `rc1-soak-${nonce}-${role}`;
  const urlFor = role => { const url = new URL(lease.url); url.searchParams.set('application_name', tag(role)); return url.toString(); };
  const pool = new pg.Pool({ connectionString: urlFor('observer'), max: 2 }), children = new Map(), records = [], writes = new Set();
  let closed = false, outputFailure = null, serial = 0, closePromise = null;
  const note = event => { const promise = recorder.record(event); writes.add(promise); promise.catch(error => { outputFailure ||= error; }).finally(() => writes.delete(promise)); return promise; };
  const common = localSoakEnvironmentValues({ databaseUrl: urlFor('api'), port: selectedPort, secrets, settings });
  const inspectOwnership = async () => {
    const q = new pg.Client({ connectionString: controlUrl });
    try { await q.connect(); const row = (await q.query("SELECT oid,shobj_description(oid,'pg_database') AS owner FROM pg_database WHERE datname=$1", [owned.name])).rows[0];
      assert(row && Number(row.oid) === Number(owned.oid)); assert.equal(row.owner, owned.ownerMarker); return row;
    } finally { await q.end(); }
  };
  // Preserve PostgreSQL microseconds for the exact identity predicate used by
  // disconnect. A JavaScript Date would truncate backend_start and match zero.
  const sessions = async () => (await pool.query('SELECT pid,application_name,state,backend_start::text AS backend_start,query_start,wait_event_type,wait_event,query FROM pg_stat_activity WHERE datname=$1 ORDER BY pid', [owned.name])).rows;
  const heartbeat = async () => (await pool.query('SELECT id,beat_at FROM worker_heartbeat ORDER BY id')).rows;
  const alive = role => { const row = children.get(role); return !!row && row.child.exitCode === null && row.child.signalCode === null; };
  const health = async () => {
    if (!alive('api')) return false;
    try { const response = await fetch(baseUrl + '/health', { signal: AbortSignal.timeout(2000), redirect: 'error' });
      const body = await response.json(); return response.status === 200 && body.db === 'up' ? { status: response.status, body } : false;
    } catch { return false; }
  };
  const launch = async role => {
    assert(['api', 'worker'].includes(role)); assert(!alive(role)); await assertSourceUnchanged(source); await inspectOwnership();
    assert.equal(sha256(await fs.readFile(node)), nodeSha256, 'Node executable changed before launch');
    const beforeHeartbeat = role === 'worker' ? await heartbeat() : null;
    const file = role === 'api' ? 'src/server.js' : 'src/worker.js', env = { ...common, DATABASE_URL: urlFor(role) };
    const child = spawn(node, [file], { cwd: process.cwd(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const row = { role, serial: ++serial, child, file, spawnedAt: new Date().toISOString(), pid: child.pid, identity: null };
    children.set(role, row); records.push(row);
    const exited = new Promise(resolve => { child.once('error', error => { row.error = failure(error); }); child.once('close', (code, signal) => { row.exit = { code, signal, at: new Date().toISOString() }; resolve(row.exit); }); });
    row.exited = exited;
    for (const [stream, pipe] of [['stdout', child.stdout], ['stderr', child.stderr]]) pipe.on('data', bytes => { note({ kind: 'soak-original-process-output', role, pid: child.pid, stream, text: bytes.toString('utf8') }); });
    row.identity = await windowsProcess(child.pid);
    assert.equal(path.resolve(row.identity.ExecutablePath).toLowerCase(), path.resolve(node).toLowerCase(), 'Child executable differs from captured runtime');
    await note({ kind: 'soak-original-process-start', role, serial: row.serial, source: source.revision, nodeSha256,
      sourceFile: file, sourceSha256: sha256(await fs.readFile(file)), identity: row.identity, environmentSha256: digest(env),
      clock: 'Unmodified wall time; original entrypoint and worker schedules' });
    if (role === 'api') await until(health, { timeoutMs: startupTimeoutMs, label: 'owned API readiness' });
    else await until(async () => {
      assert(alive(role), 'Original worker exited before readiness');
      const rows = await heartbeat(); return digest(rows) !== digest(beforeHeartbeat) && (await sessions()).some(value => value.application_name === tag('worker')) ? rows : false;
    }, { timeoutMs: startupTimeoutMs, label: 'original worker heartbeat' });
    return { role, pid: child.pid, identity: row.identity, observedAt: new Date().toISOString() };
  };
  const stop = async role => {
    const row = children.get(role); if (!row || !alive(role)) return { role, alreadyExited: true, exit: row?.exit || null };
    const actual = await windowsProcess(row.pid); assert.deepEqual(actual, row.identity, 'PID identity changed; refusing process stop');
    assert(row.child.kill('SIGKILL'), 'Could not stop owned child');
    const exit = await Promise.race([row.exited, sleep(10000).then(() => { throw new Error('Owned child did not close'); })]);
    const value = { role, pid: row.pid, exit, method: 'Owned ChildProcess handle, SIGKILL; Windows abrupt stop, not POSIX graceful shutdown' };
    await note({ kind: 'soak-original-process-stop', ...value }); return value;
  };
  const checkpoint = async label => {
    const { snapshot, diagnostics, invariants, backlog, binding } = await collectLocalSoakCheckpoint(pool, {
      sourceRevision: source.revision, configuration: { LIVING_WORLD_DIRECTOR: settings.LIVING_WORLD_DIRECTOR || 'DIRECTOR_DISABLED' } });
    const logicalAt = binding.logicalAt;
    await recorder.artifact(`local-${label}-state.json`, snapshot);
    await recorder.artifact(`local-${label}-diagnostics.json`, { diagnostics, invariants, binding });
    await recorder.artifact(`local-${label}-backlog.json`, backlog);
    const value = { label, logicalAt, stateSha256: snapshot.stateSha256, heartbeat: await heartbeat(), sessions: await sessions(),
      backlog, binding, limitation: 'Snapshot, lifecycle and invariants share original database time/state. Unsupported conditional worker authority remains explicit.' };
    await note({ kind: 'soak-local-checkpoint', checkpoint: value }); return value;
  };
  const close = () => closePromise ||= (async () => {
    if (closed) return; const failures = [];
    for (const role of ['worker', 'api']) try { await stop(role); } catch (error) { failures.push({ role, error: failure(error) }); }
    await pool.end();
    if (!failures.length) try { await inspectOwnership(); await lease.close(); } catch (error) { failures.push({ database: owned.name, error: failure(error) }); }
    await Promise.all([...writes]); closed = !failures.length;
    await recorder.artifact('local-cleanup.json', { owned, processes: records.map(row => ({ role: row.role, pid: row.pid, identity: row.identity, exit: row.exit || null })),
      closed, force: false, failures });
    assert(!failures.length, 'Owned local environment cleanup incomplete; retained ownership and failure evidence');
    if (outputFailure) throw outputFailure;
  })();
  try {
    await note({ kind: 'database-created', ...owned });
    await recorder.artifact('local-private-environment.json', { api: common, worker: { ...common, DATABASE_URL: urlFor('worker') } });
    await launch('api');
    const batch = makeInviteBatch(population); await recorder.artifact('local-invite-batch.json', batch);
    const imported = await importBatch(pool, batch); await note({ kind: 'soak-canonical-admission-import', authority: 'tools/invites.js#importBatch', result: imported });
    await launch('worker');
    const server = (await pool.query("SELECT version() AS version,current_database() AS database,pg_postmaster_start_time() AS postmaster_started_at,inet_server_addr() AS address,inet_server_port() AS port")).rows[0];
    const pgSettings = (await pool.query("SELECT name,setting,unit,source FROM pg_settings WHERE name IN ('max_connections','shared_buffers','work_mem','maintenance_work_mem','max_worker_processes','max_parallel_workers','max_parallel_workers_per_gather') ORDER BY name")).rows;
    const schema = (await pool.query('SELECT id,app_version,schema_sha,applied_at FROM schema_meta ORDER BY id')).rows;
    const envelopeEvidence = { source, baseUrl, node: { path: node, sha256: nodeSha256, version: nodeVersion, driverVersion: process.version },
      host: { platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus().map(({ model, speed }) => ({ model, speed })), totalMemoryBytes: os.totalmem(), availableParallelism: os.availableParallelism() },
      processes: records.map(row => ({ role: row.role, pid: row.pid, identity: row.identity, sourceFile: row.file })),
      processResourceSamples: await Promise.all(records.map(async row => ({ role: row.role, ...await windowsUsage(row.pid) }))),
      publicConfiguration: Object.fromEntries(Object.entries(common).filter(([key]) => !systemKeys.includes(key) && !['DATABASE_URL', 'JWT_SECRET', 'MARKET_SEED', 'MOD_KEY'].includes(key))),
      database: { owned, server, settings: pgSettings, schema, sessions: await sessions(), heartbeat: await heartbeat() },
      apiHealth: await health(), enforcement: { processCpuQuota: null, processRamQuota: null, postgresDedicatedHost: false },
      productionEquivalent: false, scope: 'Observed owned local process/database deployment; Render workspace, instance envelope and HA/failover are not attested.' };
    await recorder.artifact('local-envelope.json', envelopeEvidence);
    return { baseUrl, pool, close, source, owned, envelopeEvidence,
      admissions: batch.codes.map((inviteCode, index) => ({ inviteCode, name: `Soak ${nonce.slice(0, 6)} ${index}` })),
      checkpoint, launch, stop, health, heartbeat, sessions,
      async disconnectDatabase() {
        await inspectOwnership();
        const selected = (await sessions()).filter(row => [tag('api'), tag('worker')].includes(row.application_name));
        assert(selected.length, 'No owned API/worker sessions to disconnect');
        const results = [];
        for (const row of selected) {
          const result = await pool.query('SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE pid=$1 AND datname=$2 AND application_name=$3 AND backend_start=$4', [row.pid, owned.name, row.application_name, row.backend_start]);
          results.push({ before: row, result: result.rows });
        }
        await note({ kind: 'soak-owned-database-reconnect', database: owned.name, results, sharedPostgresServiceStopped: false });
        assert(results.some(row => row.result.some(value => value.terminated === true)), 'No exact owned backend was disconnected');
        const disconnectedPids = new Set(selected.map(row => row.pid));
        const recovered = await until(async () => {
          const probe = await health(), current = await sessions();
          return probe && current.some(row => row.application_name === tag('api') && !disconnectedPids.has(row.pid)) ? probe : false;
        }, { timeoutMs: startupTimeoutMs, label: 'API database reconnection' });
        return { results, recovered, sessionsAfter: await sessions(), workerRecovery: 'Requires subsequent original schedule/backlog observations; heartbeat alone is not complete recovery.' };
      },
    };
  } catch (error) { try { await close(); } catch { /* cleanup artifact retains the precise failure */ } throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const configuration = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  assert(configuration.controlUrl, 'An explicit disposable loopback PostgreSQL controlUrl is required');
  const faultOptions = { schedule: configuration.faultSchedule, pauseMs: configuration.faultPauseMs ?? 1000,
    reconnectActors: configuration.reconnectActors ?? 100 };
  localSoakFaultPlan({}, faultOptions); // Validate before creating any owned resources.
  assert(Object.values(faultOptions.schedule).every(atMs => atMs < configuration.durationMs), 'Faults must start inside the declared wall-time window');
  const result = await runRealtimeSoak({ configuration, prepareEnvironment: async ({ source, recorder }) => {
    const environment = await createLocalSoakEnvironment({ source, recorder, runId: configuration.runId,
      controlUrl: configuration.controlUrl, population: configuration.population, node: configuration.node || process.execPath,
      settings: configuration.environment || {}, ...(configuration.port ? { port: configuration.port } : {}) });
    return { ...environment, faults: localSoakFaultPlan(environment, faultOptions) };
  } });
  process.stdout.write(JSON.stringify({ status: result.status, source: result.source.revision, productionEquivalent: false }) + '\n');
  if (result.status !== 'PASS_SCOPED') process.exitCode = 1;
}

export function localSoakFaultPlan(environment, { schedule, pauseMs = 1000, reconnectActors = 100 }) {
  assert(schedule && faultKinds.every(kind => Number.isFinite(schedule[kind]) && schedule[kind] >= 0));
  assert(Number.isFinite(pauseMs) && pauseMs > 0); assert(Number.isSafeInteger(reconnectActors) && reconnectActors > 0);
  let ordinal = 0;
  const request = async (recorder, client, actor, value) => {
    const identity = { actorIndex: actor.actorIndex, characterId: actor.characterId,
      request: { ...value, ...(value.method === 'POST' ? { idempotencyKey: crypto.randomUUID() } : {}) } };
    await recorder.record({ kind: 'soak-fault-http-dispatch', ...identity });
    const response = await client.request({ ...identity.request, token: actor.token });
    await recorder.record({ kind: 'soak-fault-http-completion', ...identity, response });
    return response;
  };
  const ok = result => { assert(result.status >= 200 && result.status < 300, `Canonical fault preparation failed: HTTP ${result.status}, ${result.body?.error || result.error?.code || 'unknown'}`); return result.body; };
  return faultKinds.map(kind => ({ kind, atMs: schedule[kind], run: async ({ actors, client, recorder }) => {
    const label = `fault-${++ordinal}`, before = await environment.checkpoint(`${label}-before`);
    let intervention;
    if (kind === 'reconnect storm') {
      assert(actors.length >= reconnectActors); const generation = client.reconnect();
      const results = await Promise.all(actors.slice(0, reconnectActors).map(actor => request(recorder, client, actor, { method: 'GET', path: '/v1/me' })));
      assert(results.every(row => row.status === 200)); intervention = { generation, requests: results.length, successful: results.length };
    } else if (kind === 'server restart' || kind === 'worker interruption') {
      const role = kind === 'server restart' ? 'api' : 'worker', stopped = await environment.stop(role);
      await sleep(pauseMs); const restarted = await environment.launch(role);
      intervention = { stopped, pauseMs, restarted, apiHealth: await environment.health() };
    } else if (kind === 'database reconnect') intervention = await environment.disconnectDatabase();
    else {
      assert(actors.length >= 3); const [seller, ...buyers] = actors.slice(0, Math.max(3, Math.min(actors.length, reconnectActors + 1)));
      const views = await Promise.all([seller, ...buyers].map(actor => request(recorder, client, actor, { method: 'GET', path: '/v1/me' }).then(ok)));
      const rules = ok(await request(recorder, client, seller, { method: 'GET', path: '/v1/rules' }));
      const board = ok(await request(recorder, client, seller, { method: 'GET', path: '/v1/market' }));
      assert(views.every(view => view.character.jailSeconds === 0 && view.character.loc === views[0].character.loc));
      const good = [...rules.goods].sort((a, b) => a.base - b.base)[0];
      ok(await request(recorder, client, seller, { method: 'POST', path: '/v1/goods/buy', body: { goodId: good.id, qty: 1 } }));
      const listing = ok(await request(recorder, client, seller, { method: 'POST', path: '/v1/market', body: { goodId: good.id, qty: 1, price: board.levers.minPrice, hours: 1 } }));
      const publicBoard = ok(await request(recorder, client, buyers[0], { method: 'GET', path: '/v1/market' }));
      assert(publicBoard.listings.some(row => row.id === listing.id && row.qty === 1));
      const results = await Promise.all(buyers.map(actor => request(recorder, client, actor,
        { method: 'POST', path: `/v1/market/${encodeURIComponent(listing.id)}/buy`, body: { qty: 1 } })));
      const successes = results.filter(row => row.status >= 200 && row.status < 300);
      assert.equal(successes.length, 1, 'Exactly one canonical buyer must acquire the one-unit lot');
      assert(results.every(row => row.status === 200 || row.status === 400 && ['no_listing', 'again'].includes(row.body?.error)), 'Unexpected shared-object outcome');
      const row = (await environment.pool.query('SELECT id,kind,qty,status,seller_character FROM market_listings WHERE id=$1', [listing.id])).rows[0];
      assert(row && row.status === 'sold' && Number(row.qty) === 0);
      intervention = { listingId: listing.id, goodId: good.id, buyers: buyers.length, freshSales: successes.length, observedListing: row,
        contention: 'Concurrent canonical HTTP buyers of one ordinary listing; no diagnostic lock or resource fixture was injected.' };
    }
    const after = await environment.checkpoint(`${label}-after`);
    return { kind, intervention, before: { stateSha256: before.stateSha256, logicalAt: before.logicalAt },
      after: { stateSha256: after.stateSha256, logicalAt: after.logicalAt },
      verification: 'Executed original local authority/control; complete due-work recovery remains the source-pinned backlog reviewer responsibility.' };
  } }));
}
