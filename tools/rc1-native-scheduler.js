// Test-only scheduling at actual PostgreSQL query boundaries. Not a game authority.
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

const json = (value) => JSON.parse(JSON.stringify(value));
const fingerprint = (value) => sha256(canonicalJson(json(value)));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const BOARD_LOCK = /SELECT id FROM player_command_boards.*FOR UPDATE NOWAIT/s;
export const SCHEDULE_SCOPE = Object.freeze({ version: 1,
  boundaries: 'Connection acquisition, SQL dispatch, PostgreSQL completion, application delivery, and command completion.',
  observation: 'Winner holds an actual PostgreSQL issued-board row lock while contender executes FOR UPDATE NOWAIT; only observation uses this chosen overlap barrier.',
  replay: 'Replay consumes the retained event order; it does not use the observation barrier. Both requests are launched concurrently in reversed order.',
  transactionOrder: 'Actual BEGIN/COMMIT/ROLLBACK SQL and backend/transaction IDs retained. This single-winner workload has one economic writer; no claim of a global order for unmanaged writers.',
  diagnosticNormalization: ['backendPid', 'postgresTransactionId', 'observedWallClock'],
  retained: 'SQL, parameters, result hashes, SQLSTATE, request/connection/query identities, all canonical state and durable receipts.',
  exclusions: ['unobserved production schedules', 'arbitrary races', 'full worker schedule', '225-run world matrix'] });

export function createTransactionScheduler({ replay = null, injectAfterCarDebit = false, deadlineMs = 30000 } = {}) {
  if (replay) validateSchedule(replay);
  const context = new AsyncLocalStorage(), events = [], waiting = [];
  const locked = deferred(), released = deferred();
  let active = false, cursor = 0, failure = null, injectionFired = false;
  const commitOrder = [], physicalTransactions = [], commandResults = [];
  function fail(error) {
    failure ||= error;
    for (const entry of waiting.splice(0)) { clearTimeout(entry.timer); entry.reject(failure); }
    released.resolve(); locked.resolve();
  }
  function drain() {
    while (!failure && cursor < (replay?.events.length || 0)) {
      const wanted = replay.events[cursor];
      const index = waiting.findIndex((entry) => entry.event.key === wanted.key);
      if (index < 0) return;
      const [entry] = waiting.splice(index, 1);
      try {
        assert.deepEqual(entry.event, wanted, `Recorded PostgreSQL schedule diverged at ${cursor}: ${wanted.key}`);
        events.push(entry.event); cursor++; clearTimeout(entry.timer); entry.resolve();
      } catch (error) { clearTimeout(entry.timer); entry.reject(error); fail(error); }
    }
    if (!failure && replay && cursor === replay.events.length && waiting.length) fail(Error('Replay emitted events beyond the retained schedule'));
  }
  const event = async (value) => {
    if (failure) throw failure;
    const row = json(value);
    if (!replay) { events.push(row); return; }
    await new Promise((resolve, reject) => {
      const entry = { event: row, resolve, reject,
        timer: setTimeout(() => fail(Error(`Schedule timed out at ${cursor}; expected ${replay.events[cursor]?.key}; waiting ${waiting.map((w) => w.event.key).join(',')}`)), deadlineMs) };
      waiting.push(entry); drain();
    });
  };
  const run = (label, work) => context.run({ label, connections: 0 }, async () => {
    await event({ key: `${label}:command:start`, type: 'command.start', request: label });
    try {
      const value = await work();
      const result = { request: label, outcome: 'returned', replayed: value.replayed, status: value.status,
        executionId: value.executionId, resultSha256: fingerprint(value) };
      await event({ key: `${label}:command:end`, type: 'command.end', ...result }); commandResults.push(result);
      return value;
    } catch (error) {
      const result = { request: label, outcome: 'threw', code: error.code || error.name, message: error.message };
      await event({ key: `${label}:command:end`, type: 'command.end', ...result }); commandResults.push(result);
      throw error;
    }
  });
  return {
    run,
    start() { assert(!active); active = true; },
    stop() { active = false; },
    get mode() { return replay ? 'replay' : 'observe'; },
    async waitForWinnerLock() {
      const timeout = setTimeout(() => fail(Error('Winner did not acquire its PostgreSQL board lock')), deadlineMs);
      try { await locked.promise; if (failure) throw failure; } finally { clearTimeout(timeout); }
    },
    releaseWinner: () => released.resolve(),
    wrapPool(pool) {
      const connect = async () => {
        const request = active ? context.getStore() : null;
        if (!request) return pool.connect();
        const id = `${request.label}:c${++request.connections}`;
        await event({ key: `${id}:connect`, type: 'connection.request', request: request.label, connection: id });
        const client = await pool.connect();
        let queries = 0, transaction = 0, pid = null, txid = null;
        try { await event({ key: `${id}:acquired`, type: 'connection.acquired', request: request.label, connection: id }); }
        catch (error) { client.release(); throw error; }
        const query = async (sql, values, injected = false) => {
          const text = typeof sql === 'string' ? sql : sql.text;
          const parameters = values ?? (typeof sql === 'object' ? sql.values : undefined) ?? [];
          const queryId = `${id}:q${++queries}`;
          const descriptor = { request: request.label, connection: id, query: queryId, sql: text, parameters: json(parameters), injected };
          await event({ key: `${queryId}:dispatch`, type: 'query.dispatch', ...descriptor });
          if (/^\s*BEGIN\b/i.test(text)) transaction++;
          if (/^\s*COMMIT\b/i.test(text)) {
            const metadata = (await client.query('SELECT pg_backend_pid() AS pid,txid_current_if_assigned()::text AS txid')).rows[0];
            pid = metadata.pid; txid = metadata.txid;
            physicalTransactions.push({ request: request.label, connection: id, transaction,
              backendPid: pid, postgresTransactionId: txid, beforeCommit: queryId });
          }
          let result;
          try {
            result = await client.query(sql, values);
          } catch (error) {
            await event({ key: `${queryId}:complete`, type: 'query.complete', request: request.label, connection: id,
              query: queryId, outcome: 'error', code: error.code || error.name, message: error.message });
            await event({ key: `${queryId}:deliver`, type: 'query.deliver', request: request.label, connection: id, query: queryId, outcome: 'error' });
            throw error;
          }
          if (/^\s*BEGIN\b/i.test(text)) {
            const metadata = (await client.query('SELECT pg_backend_pid() AS pid,txid_current_if_assigned()::text AS txid')).rows[0];
            physicalTransactions.push({ request: request.label, connection: id, transaction,
              backendPid: metadata.pid, postgresTransactionId: metadata.txid, began: queryId });
          }
          if (BOARD_LOCK.test(text)) {
            const metadata = (await client.query('SELECT pg_backend_pid() AS pid,txid_current_if_assigned()::text AS txid')).rows[0];
            pid = metadata.pid; txid = metadata.txid;
            physicalTransactions.push({ request: request.label, connection: id, transaction,
              backendPid: pid, postgresTransactionId: txid, rowLockAcquired: queryId });
          }
          await event({ key: `${queryId}:complete`, type: 'query.complete', request: request.label, connection: id,
            query: queryId, outcome: 'returned', rowCount: result.rowCount, rowsSha256: fingerprint(result.rows) });
          if (/^\s*COMMIT\b/i.test(text)) commitOrder.push({ request: request.label, connection: id, transaction, query: queryId,
            backendPid: pid, postgresTransactionId: txid });
          if (!replay && request.label === 'winner' && BOARD_LOCK.test(text)) {
            locked.resolve(); await released.promise;
          }
          if (injectAfterCarDebit && !injectionFired && request.label === 'winner' && /^\s*DELETE FROM cars\b/i.test(text)) {
            injectionFired = true;
            await event({ key: `${queryId}:fault`, type: 'fault.after-car-debit', request: request.label, connection: id, query: queryId });
            await query("DO $$ BEGIN RAISE EXCEPTION 'RC1 scheduled failure after car debit' USING ERRCODE='P0001'; END $$", [], true);
          }
          await event({ key: `${queryId}:deliver`, type: 'query.deliver', request: request.label, connection: id, query: queryId, outcome: 'returned' });
          return result;
        };
        return { query, release: (...args) => client.release(...args) };
      };
      return { options: pool.options, connect, end: () => pool.end(),
        async query(sql, values) { const client = await connect(); try { return await client.query(sql, values); } finally { client.release(); } } };
    },
    finish() {
      if (failure) throw failure;
      if (replay) assert.equal(cursor, replay.events.length, 'Replay left required schedule events unfinished');
      const result = { format: 1, mode: replay ? 'replay' : 'observe', scope: SCHEDULE_SCOPE,
        injectionRequested: injectAfterCarDebit, injectionFired, events, commandResults, commitOrder, physicalTransactions,
        scheduleSha256: fingerprint(events) };
      validateSchedule(result); return result;
    },
    diagnostic() { return { events, commandResults, commitOrder, physicalTransactions, cursor, failure: failure?.message || null }; },
  };
}

export function validateSchedule(trace) {
  assert.equal(trace.format, 1); assert(Array.isArray(trace.events) && trace.events.length > 0);
  assert.equal(new Set(trace.events.map((entry) => entry.key)).size, trace.events.length, 'Duplicate schedule event identity');
  assert.equal(trace.scheduleSha256, fingerprint(trace.events), 'Recorded schedule hash mismatch');
  const commands = new Set(), pending = new Set();
  for (const event of trace.events) {
    if (event.type === 'command.start') commands.add(event.request);
    if (event.type === 'command.end') assert(commands.delete(event.request), 'Unmatched command completion');
    if (event.type === 'query.dispatch') pending.add(event.query);
    if (event.type === 'query.deliver') assert(pending.delete(event.query), 'Unmatched query delivery');
    if (event.type === 'fault.after-car-debit') assert(pending.delete(event.query), 'Fault lost its debit query');
  }
  assert.equal(commands.size, 0, 'Unfinished scheduled command'); assert.equal(pending.size, 0, 'Unfinished scheduled query');
  return true;
}
