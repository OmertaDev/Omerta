// TOOL47: retain the acquired session until release, including ambiguous errors.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import pg from 'pg';
import { runCityLeg } from '../src/bank.js';
import { makeDb } from '../src/db.js';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { createWorkerSchedule } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';

const bankSource = await fs.readFile(new URL('../src/bank.js', import.meta.url), 'utf8');
const start = bankSource.indexOf('export async function runCityLeg('), end = bankSource.indexOf('\nasync function runCityLegInner(', start);
assert(start >= 0 && end > start);
const wrapperSource = bankSource.slice(start, end).replace('export ', '');
const pureCases = ['connect-failure', 'acquisition-failure', 'locked', 'success', 'inner-failure', 'unlock-failure', 'inner-and-unlock-failure'];
for (const mode of pureCases) {
  const primary = Error(mode), unlock = Error('unlock failed'), releases = [], queries = []; let innerCalls = 0;
  const connection = { query: async sql => { queries.push(sql);
    if (sql.includes('pg_try_advisory_lock')) { if (mode === 'acquisition-failure') throw primary; return { rows: [{ ok: mode !== 'locked' }] }; }
    assert(sql.includes('pg_advisory_unlock')); if (mode.includes('unlock-failure')) throw unlock; return { rows: [{ pg_advisory_unlock: true }] };
  }, release: discard => releases.push(discard === true) };
  const pool = { connect: async () => { if (mode === 'connect-failure') throw primary; return connection; } };
  const inner = async () => { innerCalls++; if (mode === 'inner-failure' || mode === 'inner-and-unlock-failure') throw primary; return { paid: 0, skipped: 'empty' }; };
  const call = vm.runInNewContext(`${wrapperSource}\nrunCityLeg;`, { CITY_LOCK_CLASS: 16971, process: { env: { DATABASE_URL: 'test-only' } }, runCityLegInner: inner });
  if (['connect-failure', 'acquisition-failure', 'inner-failure', 'inner-and-unlock-failure'].includes(mode)) await assert.rejects(() => call(pool), error => error === primary);
  else assert.equal((await call(pool)).skipped, mode === 'locked' ? 'locked' : 'empty');
  assert.deepEqual(releases, mode === 'connect-failure' ? [] : [mode === 'acquisition-failure' || mode.includes('unlock-failure')]);
  assert.equal(queries.filter(sql => sql.includes('pg_advisory_unlock')).length, ['connect-failure', 'acquisition-failure', 'locked'].includes(mode) ? 0 : 1);
  assert.equal(innerCalls, ['connect-failure', 'acquisition-failure', 'locked'].includes(mode) ? 0 : 1);
}
if (!process.argv.includes('--postgres')) {
  console.log(JSON.stringify({ status: 'PASS_PURE_CONTROLS', cases: pureCases }));
} else {
  const output = process.argv.find(value => value.startsWith('--output='))?.slice(9); assert(output, 'New restricted --output required');
  const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL; assert(controlUrl, 'Disposable local PostgreSQL control URL required');
  const source = await sourceIdentity(), oldUrl = process.env.DATABASE_URL;
  const database = planOwnedWorldDatabase({ controlUrl, runId: path.basename(output), sourceRevision: source.revision });
  const proof = await createProofRecorder({ directory: output, source, runId: path.basename(output), seed: 'tool47-fixed-controls',
    scenarioId: 'scoped-city-lock-release', population: 0, configuration: { database: database.descriptor, pureCases,
      nativeCases: ['pre-acquisition-failure', 'native-terminated-acquisition', 'post-acquisition-observer-failure', 'locked', 'success', 'inner-rollback', 'unlock-before-failure', 'unlock-after-failure'],
      scope: 'Actual canonical City leg on empty original pool; injected error paths and session custody only. No reward fixture, matrix or restart-equivalence claim.' } });
  let bootstrap, inspector, activeRaw, activeHolder, result = { status: 'FAIL' }; const cases = [], leasedClients = [];
  const timeout = async promise => {
    let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Worker pool close exceeded5000ms')), 5000); })]); }
    finally { clearTimeout(timer); }
  };
  try {
    await proof.record({ kind: 'database-created', ...await database.create() }); process.env.DATABASE_URL = database.url;
    bootstrap = await makeDb();
    const initialized = await proof.invoke('runCityLeg', { phase: 'canonical-empty-pool-initialization' }, () => runCityLeg(bootstrap));
    assert.equal(initialized.skipped, 'empty'); await bootstrap.end(); bootstrap = null;
    inspector = new pg.Pool({ connectionString: database.url, max: 1 });
    const initial = await proof.snapshot(inspector, 'initial');
    for (const mode of ['pre-acquisition-failure', 'native-terminated-acquisition', 'post-acquisition-observer-failure', 'locked', 'success', 'inner-rollback', 'unlock-before-failure', 'unlock-after-failure']) {
      const primary = Error(`Injected ${mode}`), queries = [], releases = [], boundaries = [], transportErrors = [];
      let nativeQueryError;
      const raw = new pg.Pool({ connectionString: database.url, max: 2 }); activeRaw = raw; let connectId = 0;
      const observer = createNativeCommitObserver({ onBoundary: async event => {
        boundaries.push(event); if (mode === 'post-acquisition-observer-failure' && event.sequence === 1) throw primary;
      } });
      const pool = { connect: async () => {
        const client = await raw.connect(), id = ++connectId, lease = { client, released: false }; leasedClients.push(lease);
        // The canonical makeDb installs this event handler too. A checked-out
        // terminated-client event must not kill the native rejection control.
        client.on('error', error => transportErrors.push({ code: error.code || null, message: error.message }));
        const query = observer.wrapQuery(client, async (sql, values) => {
          queries.push({ client: id, sql, values: values || [] });
          if (mode === 'pre-acquisition-failure' && sql.includes('pg_try_advisory_lock')) throw primary;
          if (mode === 'native-terminated-acquisition' && sql.includes('pg_try_advisory_lock')) {
            assert.equal((await inspector.query('SELECT pg_terminate_backend($1) AS terminated', [client.processID])).rows[0].terminated, true);
            try { return await client.query(sql, values); }
            catch (error) { nativeQueryError = error; throw error; }
          }
          if (mode === 'inner-rollback' && sql.includes('FROM bank_epochs')) throw primary;
          if (mode === 'unlock-before-failure' && sql.includes('pg_advisory_unlock')) throw primary;
          const value = await client.query(sql, values);
          if (mode === 'unlock-after-failure' && sql.includes('pg_advisory_unlock')) throw primary;
          return value;
        });
        return new Proxy(client, { get(target, key) { if (key === 'query') return query;
          if (key === 'release') return discard => { releases.push({ client: id, discard: discard === true }); lease.released = true; return target.release(discard); };
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
      }, end: () => raw.end() };
      const controller = createWorkerSchedule({ start: 0, setClock: () => {} }); controller.pools.push(pool);
      let held = null;
      if (mode === 'locked') { held = await inspector.connect(); activeHolder = held; await held.query('SELECT pg_advisory_lock($1,$2)', [16971, 0]); }
      observer.arm(); let outcome;
      await proof.invoke('runCityLeg', { mode }, async () => {
        if (mode === 'native-terminated-acquisition') {
          await assert.rejects(() => runCityLeg(pool), error => error === nativeQueryError);
          assert(nativeQueryError && (nativeQueryError.code === '57P01' || /connection|terminated|queryable/i.test(nativeQueryError.message)));
          outcome = { rejected: nativeQueryError.message, code: nativeQueryError.code || null, exactErrorIdentity: true, nativeTransportFailure: true };
        } else if (['pre-acquisition-failure', 'post-acquisition-observer-failure', 'inner-rollback'].includes(mode)) {
          await assert.rejects(() => runCityLeg(pool), error => error === primary); outcome = { rejected: primary.message, exactErrorIdentity: true };
        } else { outcome = await runCityLeg(pool); assert.equal(outcome.skipped, mode === 'locked' ? 'locked' : 'empty'); }
        return outcome;
      });
      observer.disarm();
      assert.equal(releases.filter(row => row.client === 1).length, 1, 'Lock client must release once');
      const discard = ['pre-acquisition-failure', 'native-terminated-acquisition', 'post-acquisition-observer-failure', 'unlock-before-failure', 'unlock-after-failure'].includes(mode);
      assert.equal(releases.find(row => row.client === 1).discard, discard);
      assert.equal(queries.filter(row => row.sql.includes('pg_advisory_unlock')).length,
        ['pre-acquisition-failure', 'native-terminated-acquisition', 'post-acquisition-observer-failure', 'locked'].includes(mode) ? 0 : 1);
      if (mode === 'inner-rollback') assert(queries.some(row => row.sql === 'ROLLBACK'), 'Original inner failure must roll back');
      if (held) { assert.equal((await held.query('SELECT pg_advisory_unlock($1,$2) AS unlocked', [16971, 0])).rows[0].unlocked, true); held.release(); held = null; activeHolder = null; }
      await timeout(controller.close()); activeRaw = null;
      assert.equal(raw.totalCount, 0); assert.equal(raw.idleCount, 0);
      const locks = (await inspector.query("SELECT l.classid::text FROM pg_locks l JOIN pg_database d ON d.oid=l.database WHERE d.datname=current_database() AND l.locktype='advisory'")).rows;
      assert.deepEqual(locks, [], 'Cleanup must leave no City lock session');
      const state = await proof.snapshot(inspector, `after-${mode}`); assert.equal(state.stateSha256, initial.stateSha256, 'Empty-pool/failure control changed canonical state');
      const entry = { mode, outcome, queries, releases, boundaries, transportErrors, observer: observer.diagnostic(), canonicalStateSha256: state.stateSha256,
        poolClosed: true, advisoryLocksRemaining: 0, originalInnerRollback: mode === 'inner-rollback' };
      await proof.artifact(`control-${mode}.json`, entry); cases.push(entry);
    }
    result = { status: 'PASS_SCOPED', pureCases: pureCases.length, nativeCases: cases.length, fullStateStable: true,
      sourceRevision: source.revision, originalBankEconomicRulesUnchanged: true, matrixQualifying: false };
    await proof.record({ kind: 'assertions', ...result });
  } catch (error) {
    result = { status: 'FAIL', error: error.message, stack: error.stack, completedCases: cases.length };
    await proof.record({ kind: 'failure', ...result }); process.exitCode = 1;
  } finally {
    for (const lease of leasedClients) if (!lease.released) { lease.client.release(true); lease.released = true; }
    if (activeHolder) activeHolder.release(true);
    if (activeRaw) await timeout(activeRaw.end()).catch(error => { result.cleanupFailure = error.message; result.status = 'FAIL'; });
    if (bootstrap) await bootstrap.end(); if (inspector) await inspector.end();
    await proof.record({ kind: 'database-cleanup', ...await database.close() });
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    const record = await proof.finish(result); await verifyArtifactIndex(output, record);
  }
  console.log(JSON.stringify(result));
}
