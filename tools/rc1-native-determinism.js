// Opt-in test-process seams. Never imported by production code.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const NativeDate = globalThis.Date;
let installed = false;
export const SERIAL_EPOCH = '2026-09-20T12:00:00.000Z';
export const SERIAL_SEAMS = Object.freeze({ version: 1,
  applicationClock: 'Date.now and zero-argument new Date use the declared logical clock; dated constructors retain their argument.',
  databaseClock: 'Isolated-schema now/transaction_timestamp use the logical time at BEGIN; clock_timestamp/statement_timestamp use logical statement time.',
  randomness: 'SHA256(seed, stream, counter) generates test UUID/randomBytes/Math.random decisions. Canonical fixture boost overrides remain explicitly declared.',
  ordering: 'Serial actor requests and serial exact duplicate retry. No claim about concurrent scheduling.',
  normalization: 'No fields excluded; all IDs, timestamps, balances, visibility, state, outcomes, receipts and sequences retained.',
  workers: 'Only explicitly invoked canonical Director work runs. Logical-time control does not imply full worker interval coverage.' });

export function installSerialRuntime(seed, epoch = SERIAL_EPOCH) {
  assert(!installed, 'Only one serial runtime may be installed in a process');
  assert(typeof seed === 'string' && seed.length > 0);
  const start = NativeDate.parse(epoch); assert(Number.isFinite(start));
  const original = { Date: globalThis.Date, random: Math.random, randomBytes: crypto.randomBytes, randomUUID: crypto.randomUUID };
  const counters = new Map(), tape = [], randomScope = new AsyncLocalStorage();
  let clock = () => start;
  const bytes = (size, stream) => {
    if (randomScope.getStore()) stream = `scope:${randomScope.getStore()}:${stream}`;
    assert(Number.isSafeInteger(size) && size >= 0);
    const counter = (counters.get(stream) || 0) + 1; counters.set(stream, counter);
    const chunks = [];
    for (let block = 0; block * 32 < size; block++) chunks.push(crypto.createHash('sha256')
      .update(JSON.stringify(['omerta:rc1:serial:v1', seed, stream, counter, block])).digest());
    const result = Buffer.concat(chunks).subarray(0, size);
    tape.push({ stream, counter, hex: result.toString('hex') });
    return result;
  };
  class LogicalDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [LogicalDate.now()])); }
    static now() { return clock(); }
  }
  globalThis.Date = LogicalDate;
  crypto.randomBytes = (size, callback) => {
    const value = bytes(size, 'crypto.randomBytes');
    if (callback) { queueMicrotask(() => callback(null, value)); return; }
    return value;
  };
  crypto.randomUUID = () => {
    const value = bytes(16, 'crypto.randomUUID'); value[6] = (value[6] & 15) | 64; value[8] = (value[8] & 63) | 128;
    const hex = value.toString('hex'); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  Math.random = () => bytes(6, 'Math.random').readUIntBE(0, 6) / 281474976710656;
  syncBuiltinESMExports(); installed = true;
  return {
    epoch, seed, tape,
    bindClock(read) { assert.equal(typeof read, 'function'); clock = read; },
    // Repeated startup includes unused seed/selection draws and operational telemetry. Keep all
    // of them on the tape without advancing the continuation's gameplay entropy. Callers still
    // compare every authoritative startup effect; this never makes a duplicate effect acceptable.
    withRestartStartup(work) { return randomScope.run('worker-restart-startup', work); },
    restoreTape(prior) {
      assert.equal(tape.length, 0, 'Random state restoration must precede all new draws');
      assert(Array.isArray(prior), 'Missing retained random tape');
      for (const entry of prior) {
        const baseStream = entry.stream.replace(/^scope:worker-restart-startup:/, '');
        assert(['crypto.randomUUID', 'crypto.randomBytes', 'Math.random'].includes(baseStream), 'Unknown random stream');
        assert(typeof entry.hex === 'string' && /^(?:[a-f0-9]{2})*$/.test(entry.hex), 'Malformed random tape bytes');
        if (baseStream === 'crypto.randomUUID') assert.equal(entry.hex.length, 32, 'Invalid UUID random draw size');
        if (baseStream === 'Math.random') assert.equal(entry.hex.length, 12, 'Invalid Math.random draw size');
        bytes(entry.hex.length / 2, entry.stream);
        assert.deepEqual(tape.at(-1), entry, 'Retained random tape differs from seed/counter');
      }
    },
    restore() {
      globalThis.Date = original.Date; Math.random = original.random;
      crypto.randomBytes = original.randomBytes; crypto.randomUUID = original.randomUUID;
      syncBuiltinESMExports(); installed = false;
    },
  };
}

export function serialDatabaseOptions({ commitObserver = null } = {}) {
  return {
    poolFactory(configuration, namespace) {
      assert(installed, 'The deterministic runtime must be installed first');
      assert(/^[a-z_][a-z_0-9]*$/.test(namespace));
      // Explicit pg_catalog placement makes only this test schema's clock functions
      // resolve ahead of builtins. No function in pg_catalog/public is replaced.
      const raw = new pg.Pool({ ...configuration,
        options: configuration.options.replace(`search_path=${namespace}`, `search_path=${namespace},pg_catalog`) });
      const rawConnect = raw.connect.bind(raw);
      const connect = async () => {
        const client = await rawConnect();
        let transactionTime = null, failed = false;
        const query = async (sql, values) => {
            const text = typeof sql === 'string' ? sql : sql.text;
            assert.equal(typeof text, 'string');
            assert(!/\b(?:CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|LOCALTIMESTAMP|LOCALTIME)\b/i.test(text),
              'Uncontrolled SQL clock keyword encountered');
            assert(!/\bpg_catalog\.(?:now|clock_timestamp|statement_timestamp|transaction_timestamp)\s*\(/i.test(text),
              'Canonical query bypasses the explicit test clock');
            const begins = /^\s*BEGIN\b/i.test(text), rollbackTo = /^\s*ROLLBACK\s+TO\b/i.test(text);
            const ends = /^\s*(?:COMMIT|ROLLBACK)\b/i.test(text) && !rollbackTo;
            if (begins) transactionTime = new NativeDate(Date.now()).toISOString();
            const statementTime = new NativeDate(Date.now()).toISOString();
            if (!failed) await client.query("SELECT set_config('rc1.transaction_time',$1,false),set_config('rc1.statement_time',$2,false)",
              [transactionTime || statementTime, statementTime]);
            try {
              const result = await client.query(sql, values);
              if (ends) { transactionTime = null; failed = false; }
              else if (rollbackTo) failed = false;
              return result;
            } catch (error) { failed = transactionTime !== null; throw error; }
        };
        const observedQuery = commitObserver ? commitObserver.wrapQuery(client, query) : query;
        // Keep EventEmitter methods, driver identity and symbols on the actual
        // client so makeDb's once-per-client error hooks remain authoritative.
        return new Proxy(client, { get(target, key) {
          if (key === 'query') return observedQuery;
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
      };
      return { connect, options: raw.options, on: (...args) => raw.on(...args),
        async query(sql, values) { const client = await this.connect(); try { return await client.query(sql, values); } finally { client.release(); } },
        end: () => raw.end(),
      };
    },
    async initialize(pool) {
      for (const [name, field, volatility] of [['now', 'transaction_time', 'STABLE'],
        ['transaction_timestamp', 'transaction_time', 'STABLE'], ['statement_timestamp', 'statement_time', 'STABLE'],
        ['clock_timestamp', 'statement_time', 'VOLATILE']]) {
        await pool.query(`CREATE FUNCTION ${name}() RETURNS timestamptz LANGUAGE sql ${volatility}
          AS $$ SELECT pg_catalog.current_setting('rc1.${field}')::timestamptz $$`);
      }
    },
  };
}
