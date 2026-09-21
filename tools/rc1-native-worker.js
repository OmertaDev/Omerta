// Test-only loader instrumentation. The original worker remains the job authority.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { serialDatabaseOptions } from './rc1-native-determinism.js';

export const WORKER_SOURCE_PINS = Object.freeze({
  'src/worker.js': 'e523f9a2bdaaa4886f48663f8e57f4fc537876782f3d73b3151cd33f3b9e7746',
  'src/db.js': '6033b850aa9843703b0907c32da9a3032bd501c893ad32835b0fbfe03c3750b8',
});
const plain = (value) => value === undefined ? null : JSON.parse(JSON.stringify(value));
const fingerprint = (value) => sha256(canonicalJson(plain(value)));
const NativeDate = Date;
const timeout = globalThis.setTimeout, clearTimeoutNative = globalThis.clearTimeout;

export function createWorkerSchedule({ start, setClock, expectedDormant = [], deadlineMs = 60000 } = {}) {
  let now = start, identity = 0;
  const timers = new Map(), boots = [], events = [], jobs = [], actors = [], failures = [], logs = [], pools = [], transformations = [];
  const initial = performance.now();
  const record = (kind, fields = {}) => events.push({ sequence: events.length + 1, kind, logicalAt: now, ...fields });
  const register = (repeat, callback, delay, ...args) => {
    assert.equal(typeof callback, 'function'); assert(Number.isFinite(delay) && delay > 0, 'Invalid production timer period');
    const id = ++identity, entry = { id, callback, args, repeat, period: delay, due: now + delay,
      label: callback.name || (repeat ? 'watchdog' : 'health-boundary'), callbackSha256: sha256(callback.toString()) };
    const handle = { id, unref() { record('timer.unref', { id }); return handle; }, ref() { return handle; } };
    timers.set(id, entry); record('timer.register', { id, label: entry.label, repeat, period: delay, due: entry.due, callbackSha256: entry.callbackSha256 });
    return handle;
  };
  const cancel = (handle) => { if (timers.delete(handle?.id)) record('timer.clear', { id: handle.id }); };
  async function invoke(label, fn) {
    record('callback.start', { label });
    const started = performance.now(); let deadline;
    try {
      await Promise.race([Promise.resolve().then(fn), new Promise((_, reject) => {
        deadline = timeout(() => reject(Error(`Worker callback ${label} exceeded ${deadlineMs}ms; pending jobs: ${jobs.filter((j) => j.status === 'RUNNING').map((j) => j.label).join(',')}`)), deadlineMs);
      })]);
      record('callback.complete', { label });
      assert.equal(failures.length, 0, `Unexpected production worker failure: ${failures.map((f) => f.message).join('; ')}`);
    } finally { clearTimeoutNative(deadline); record('callback.wall-duration', { label, elapsedMs: performance.now() - started }); }
  }
  const api = {
    timers: { setInterval: (fn, ms, ...args) => register(true, fn, ms, ...args),
      setTimeout: (fn, ms, ...args) => register(false, fn, ms, ...args), clearInterval: cancel, clearTimeout: cancel },
    boot(label, callback) {
      let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
      boots.push({ label, callback, resolve, reject }); record('boot.register', { label }); return promise;
    },
    async job(label, fn) {
      const entry = { label, logicalAt: now, status: 'RUNNING' }; jobs.push(entry);
      try { const value = await fn(); Object.assign(entry, { status: 'RETURNED', result: plain(value) }); return value; }
      catch (error) {
        const expected = expectedDormant.some((item) => item.label === label && item.code === error.code);
        Object.assign(entry, { status: expected ? 'EXPECTED_DORMANT' : 'FAILED', code: error.code || error.name, message: error.message });
        if (!expected) failures.push({ label, code: entry.code, message: error.message });
        throw error;
      }
    },
    async drainBoot() {
      for (const entry of boots.splice(0)) {
        try { await invoke(`boot:${entry.label}`, entry.callback); entry.resolve(); }
        // Retain the failure before stopping the harness. The scheduling
        // acknowledgement must not trigger the production boot catch's exit
        // while the evidence recorder is sealing the first failing state.
        catch (error) { entry.resolve(); throw error; }
      }
    },
    async actor(identity, work) {
      assert.equal(typeof identity?.accountId, 'string'); assert(identity.accountId.length > 0);
      assert(['player.snapshot', 'player.execute'].includes(identity.authority)); assert.equal(typeof work, 'function');
      if (identity.authority === 'player.execute') assert.equal(typeof identity.executionId, 'string');
      const entry = { identity: plain(identity), logicalAt: now, status: 'RUNNING' }; actors.push(entry);
      record('actor.start', { identity: entry.identity });
      try {
        const result = await work(); Object.assign(entry, { status: 'RETURNED', result: plain(result) });
        record('actor.complete', { identity: entry.identity, outcome: 'RETURNED', resultSha256: fingerprint(result) }); return result;
      } catch (error) {
        Object.assign(entry, { status: 'THREW', code: error.code || error.name, message: error.message });
        record('actor.complete', { identity: entry.identity, outcome: 'THREW', code: entry.code, message: entry.message }); throw error;
      }
    },
    async advanceTo(until, afterBoundary = async () => {}) {
      assert(Number.isSafeInteger(until) && until >= now);
      while (true) {
        const next = [...timers.values()].sort((a, b) => a.due - b.due || a.id - b.id)[0];
        if (!next || next.due > until) break;
        now = next.due; setClock(now);
        if (next.repeat) next.due += next.period; else timers.delete(next.id);
        record('timer.fire', { id: next.id, label: next.label });
        await invoke(next.label, () => next.callback(...next.args));
        await afterBoundary(now, next.label);
      }
      now = until; setClock(now);
    },
    log(level, args) {
      const message = args.map((value) => value instanceof Error ? `${value.code || value.name}: ${value.message}` : typeof value === 'string' ? value : JSON.stringify(value)).join(' ');
      logs.push({ level, logicalAt: now, message });
      if (level !== 'error') return;
      const knownDormant = expectedDormant.some((item) => args[0] === `worker: ${item.label} failed` && args[1]?.code === item.code);
      const declaredLocalBackup = message.startsWith('🚨 BACKUPS ARE NOT RUNNING (off)') || message.startsWith('🚨 BACKUP INVARIANT DRIFT:');
      if (!knownDormant && !declaredLocalBackup) failures.push({ label: 'console.error', message });
    },
    diagnostic() { return { format: 1, start, logicalAt: now, events, jobs, actors, failures, logs, transformations,
      activeTimers: [...timers.values()].map(({ callback, args, ...entry }) => entry),
      startedWallClock: new NativeDate().toISOString(), elapsedWallMs: performance.now() - initial,
      scheduleSha256: fingerprint(events.filter((event) => event.kind !== 'callback.wall-duration')) }; },
    pools, transformations,
    async close() { timers.clear(); await Promise.all(pools.map((pool) => pool.end())); },
  };
  return api;
}

export function installWorkerInstrumentation(controller, { namespace, queryOrder = null, root = new URL('../', import.meta.url) } = {}) {
  assert(!globalThis.__rc1Worker); assert(/^[a-z_][a-z_0-9]*$/.test(namespace));
  const clock = serialDatabaseOptions();
  controller.Pool = class {
    constructor(configuration) {
      let pool = clock.poolFactory({ ...configuration, options: `${configuration.options || ''} -c search_path=${namespace}` }, namespace);
      if (queryOrder) pool = queryOrder.wrapPool(pool);
      controller.pools.push(pool); return pool;
    }
  };
  globalThis.__rc1Worker = controller;
  const replaceOnce = (source, from, to, edits) => {
    assert.equal(source.split(from).length - 1, 1, `Worker instrumentation site changed: ${from}`);
    edits.push({ original: from, replacement: to }); return source.replace(from, to);
  };
  const paths = new Map(Object.keys(WORKER_SOURCE_PINS).map((file) => [fileURLToPath(new URL(file, root)).toLowerCase(), file]));
  const hook = registerHooks({ load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.startsWith('file:')) return result;
    const file = paths.get(fileURLToPath(url).toLowerCase()); if (!file) return result;
    const raw = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
    const original = raw.replaceAll('\r\n', '\n'), edits = [];
    assert.equal(sha256(original), WORKER_SOURCE_PINS[file], `Pinned production source changed: ${file}`);
    let source = original;
    if (file === 'src/db.js') source = replaceOnce(source, "const { Pool } = await import('pg');", 'const { Pool } = globalThis.__rc1Worker;', edits);
    else {
      const prepend = 'const { setInterval, setTimeout, clearInterval, clearTimeout } = globalThis.__rc1Worker.timers;\n';
      edits.push({ original: '<module prefix>', replacement: prepend }); source = prepend + source;
      for (const [name, label] of [['directorTick', 'director'], ['guardedSeasonTick', 'season'], ['guardedLiquidityTick', 'liquidity']])
        source = replaceOnce(source, `void ${name}();`, `void globalThis.__rc1Worker.boot('${label}', () => ${name}());`, edits);
      source = replaceOnce(source, 'void guardedTick().catch((e) => {', "void globalThis.__rc1Worker.boot('hourly', () => guardedTick()).catch((e) => {", edits);
      source = replaceOnce(source, 'try { return await fn(); } catch (e) {', 'try { return await globalThis.__rc1Worker.job(label, fn); } catch (e) {', edits);
    }
    controller.transformations.push({ file, originalSourceSha256: sha256(raw), pinnedLfSha256: sha256(original),
      transformedSourceSha256: sha256(source), originalSource: raw, transformedSource: source, edits });
    return { ...result, source };
  } });
  return { clock, restore() { hook.deregister(); delete globalThis.__rc1Worker; } };
}

let workerBoots = 0;
async function pinnedDatabaseModule(controller, root) {
  assert.equal(globalThis.__rc1Worker, controller, 'Install source-pinned instrumentation before importing production modules');
  const module = await import(new URL('src/db.js', root).href);
  assert(controller.transformations.some((entry) => entry.file === 'src/db.js' && entry.pinnedLfSha256 === WORKER_SOURCE_PINS['src/db.js']),
    'Cached uninstrumented db.js is forbidden before any database boot');
  return module;
}

export async function makeWorkerDatabase(controller, { root = new URL('../', import.meta.url) } = {}) {
  const { makeDb } = await pinnedDatabaseModule(controller, root); return makeDb();
}

export async function bootOriginalWorker(controller, { root = new URL('../', import.meta.url) } = {}) {
  // Reject a cached uninstrumented database module BEFORE worker import can
  // call makeDb or touch any schema. A post-boot check would be too late.
  await pinnedDatabaseModule(controller, root);
  const entry = new URL('src/worker.js', root), original = process.argv[1];
  try {
    process.argv[1] = fileURLToPath(entry);
    await import(`${entry.href}?rc1worker=${++workerBoots}`);
  } finally { process.argv[1] = original; }
  assert.deepEqual([...new Set(controller.transformations.map((item) => item.file))].sort(), Object.keys(WORKER_SOURCE_PINS).sort(),
    'Install instrumentation before importing db.js; cached uninstrumented authority is forbidden');
  await controller.drainBoot(); return controller;
}

export async function dropWorkerSchema(base, namespace) {
  assert(/^rc1_worker_[a-z_0-9]+$/.test(namespace), 'Refuse cleanup outside an owned worker fixture schema');
  const external = await base.query(`SELECT 1 FROM pg_constraint c
    JOIN pg_class target ON target.oid=c.confrelid JOIN pg_namespace tn ON tn.oid=target.relnamespace
    JOIN pg_class source ON source.oid=c.conrelid JOIN pg_namespace sn ON sn.oid=source.relnamespace
    WHERE tn.nspname=$1 AND sn.nspname<>$1 LIMIT 1`, [namespace]);
  assert.equal(external.rowCount, 0, 'Refuse cascading cleanup of external dependencies');
  const tables = (await base.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [namespace])).rows;
  // A single DROP SCHEMA transaction can exceed the local server's lock-table
  // budget after hundreds of indexed tables. Each owned table is its own txn.
  for (const { tablename } of tables) {
    assert(/^[a-z_][a-z_0-9]*$/.test(tablename));
    await base.query(`DROP TABLE IF EXISTS "${namespace}"."${tablename}" CASCADE`);
  }
  await base.query(`DROP SCHEMA "${namespace}" CASCADE`);
}
