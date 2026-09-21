// A recorded observation seam for one demonstrated nondeterministic SQL order.
// Reordering is permitted only when native PostgreSQL returned the same values.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const normalizedSql = (sql) => sql.replace(/\s+/g, ' ').trim();
export const QUERY_ORDER_SCOPE = Object.freeze({ version: 1,
  source: 'src/population.js/runPopulationInner/JAILBIRDS',
  sql: 'SELECT id FROM characters WHERE alive AND is_npc AND (jail_until IS NULL OR jail_until < now()) AND (hosp_until IS NULL OR hosp_until < now()) LIMIT 24',
  reason: 'Native SQL leaves order unspecified, then canonical code indexes that array using Math.random. First demonstrated divergence: logical hour 2 in worker-two-seasons-replay-1.',
  permitted: 'Replay only the observed row order after exact multiset equality, including duplicate multiplicities.',
  failClosed: 'Changed row membership, row values, parameters, query count or SQL fail. LIMIT 24 membership remains native and is never fabricated.' });

export function replayRowOrder(actual, recorded) {
  const entries = new Map();
  for (const row of actual) { const key = canonicalJson(plain(row)); const values = entries.get(key) || []; values.push(row); entries.set(key, values); }
  assert.equal(actual.length, recorded.length, 'Recorded SQL row count differs');
  const result = recorded.map((row) => {
    const key = canonicalJson(row), values = entries.get(key);
    assert(values?.length, 'Recorded SQL row membership/value differs'); return values.shift();
  });
  assert([...entries.values()].every((rows) => !rows.length), 'Recorded SQL row multiplicity differs');
  return result;
}

export function createRecordedQueryOrder({ replay = null } = {}) {
  if (replay) {
    assert.deepEqual(replay.scope, QUERY_ORDER_SCOPE); assert(Array.isArray(replay.records));
    assert.equal(replay.recordsSha256, sha256(canonicalJson(replay.records)), 'Recorded query order hash differs');
  }
  const records = [], arrivals = []; let failure = null;
  const observe = (sql, values, result) => {
    const text = typeof sql === 'string' ? sql : sql.text;
    if (normalizedSql(text) !== QUERY_ORDER_SCOPE.sql) return result;
    const parameters = plain(values ?? (typeof sql === 'object' ? sql.values : undefined) ?? []);
    const nativeRows = plain(result.rows), sequence = records.length + 1;
    arrivals.push({ sequence, rows: nativeRows });
    let row = { sequence, sql: text, parameters, rows: nativeRows };
    if (replay) {
      const expected = replay.records[records.length]; assert(expected, 'Unrecorded SQL occurrence');
      assert.equal(expected.sequence, sequence); assert.equal(expected.sql, text); assert.deepEqual(expected.parameters, parameters);
      result.rows = replayRowOrder(result.rows, expected.rows); row = expected;
    }
    records.push(row); return result;
  };
  return {
    wrapPool(pool) {
      const connect = pool.connect.bind(pool);
      pool.connect = async (...args) => {
        const client = await connect(...args);
        return new Proxy(client, { get(target, key) {
          if (key === 'query') return async (sql, values) => {
            const result = await target.query(sql, values);
            try { return observe(sql, values, result); }
            catch (error) { failure ||= { message: error.message, stack: error.stack }; throw error; }
          };
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
      };
      return pool;
    },
    diagnostic() { return { format: 1, mode: replay ? 'recorded-order-replay' : 'observe', scope: QUERY_ORDER_SCOPE,
      records, arrivals, failure, recordsSha256: sha256(canonicalJson(records)) }; },
    finish() {
      assert(!failure, failure?.message);
      if (replay) assert.equal(records.length, replay.records.length, 'Unconsumed recorded SQL occurrences');
      return this.diagnostic();
    },
  };
}
