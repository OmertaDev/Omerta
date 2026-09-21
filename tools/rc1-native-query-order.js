// Test-only recording of one demonstrated unordered PostgreSQL LIMIT choice.
// No subset can be replayed unless its complete eligible state still matches.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

const plain = (value) => JSON.parse(JSON.stringify(value));
const normalizedSql = (sql) => sql.replace(/\s+/g, ' ').trim();
const originalSql = `SELECT id FROM characters WHERE alive AND is_npc
         AND (jail_until IS NULL OR jail_until < now())
         AND (hosp_until IS NULL OR hosp_until < now()) LIMIT 24`;
const eligibleSql = originalSql.replace(/^SELECT id /, 'SELECT * ').replace(/ LIMIT 24$/, '');
// Both subqueries use the same statement snapshot, including an empty universe.
// Eligible rows remain JSON strings, preserving exact PostgreSQL numeric text.
const transformedSql = `SELECT
  COALESCE((SELECT json_agg(rc1_limited) FROM (${originalSql}) rc1_limited), '[]'::json) AS limited_rows,
  COALESCE((SELECT json_agg(row_to_json(rc1_eligible)::text) FROM (${eligibleSql}) rc1_eligible), '[]'::json) AS eligible_rows`;
export const QUERY_ORDER_SCOPE = Object.freeze({ version: 2,
  source: 'src/population.js/runPopulationInner/JAILBIRDS',
  sourceSha256: '7a54934015fa68f99d008aca4699b168efc6b8e1c73dbccd8e3c9802396c151c',
  sql: normalizedSql(originalSql), originalSql, eligibleSql, transformedSql,
  originalSqlSha256: sha256(originalSql), transformedSqlSha256: sha256(transformedSql), limit: 24,
  reason: 'Native SQL leaves LIMIT membership and order unspecified before canonical Math.random indexing. Version 1 full replay failed at occurrence 269 because three candidate IDs changed.',
  permitted: 'Record the actual native limited result and complete eligible character rows in one PostgreSQL statement snapshot. Replay the observed subset/order only after exact eligible multiset equality including all values and duplicate multiplicities.',
  failClosed: 'Changed eligible membership, values, multiplicities, source, SQL, parameters, query count or selected cardinality fails. This records nondeterministic selection; it is not seed-only equivalence.' });

function selectRows(actual, selected) {
  const entries = new Map();
  for (const row of actual) { const key = canonicalJson(plain(row)); const values = entries.get(key) || []; values.push(row); entries.set(key, values); }
  return selected.map((row) => {
    const key = canonicalJson(row), values = entries.get(key);
    assert(values?.length, 'Recorded SQL row membership/value differs'); return values.shift();
  });
}

export function replayRowOrder(actual, recorded) {
  assert.equal(actual.length, recorded.length, 'Recorded SQL row count differs');
  return selectRows(actual, recorded);
}

export function replayCandidateSelection({ eligibleRows, nativeRows, recordedEligibleRows = eligibleRows, recordedRows = nativeRows, limit = 24 }) {
  assert(Array.isArray(eligibleRows) && Array.isArray(nativeRows));
  assert(Number.isSafeInteger(limit) && limit > 0);
  // Comparing raw PostgreSQL JSON text also retains numeric values beyond JS's
  // safe integer range. Only the ID is parsed to check the selected projection.
  replayRowOrder(eligibleRows, recordedEligibleRows);
  const eligibleIds = eligibleRows.map((row) => {
    assert.equal(typeof row, 'string'); const id = JSON.parse(row).id;
    assert.equal(typeof id, 'string'); return { id };
  });
  const count = Math.min(limit, eligibleRows.length);
  assert.equal(nativeRows.length, count, 'Native SQL selected cardinality differs');
  assert.equal(recordedRows.length, count, 'Recorded SQL selected cardinality differs');
  selectRows(eligibleIds, nativeRows);
  return selectRows(eligibleIds, recordedRows);
}

export function createRecordedQueryOrder({ replay = null, root = new URL('../', import.meta.url) } = {}) {
  const source = fs.readFileSync(new URL('src/population.js', root), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(sha256(source), QUERY_ORDER_SCOPE.sourceSha256, 'Population query source differs from pinned source');
  assert.equal(source.split(originalSql).length - 1, 1, 'Population query instrumentation site differs');
  if (replay) {
    assert.equal(replay.format, 2); assert.deepEqual(replay.scope, QUERY_ORDER_SCOPE); assert(Array.isArray(replay.records));
    assert.equal(replay.recordsSha256, sha256(canonicalJson(replay.records)), 'Recorded query selection hash differs');
  }
  const records = [], arrivals = []; let failure = null;
  const observe = (sql, values, result) => {
    const parameters = plain(values ?? []), sequence = records.length + 1;
    assert.equal(result.rows.length, 1, 'Recorded SQL snapshot wrapper must return one row');
    const { limited_rows: nativeRows, eligible_rows: eligibleRows } = result.rows[0];
    arrivals.push({ sequence, rows: plain(nativeRows), eligibleRows: plain(eligibleRows) });
    let row = { sequence, sql, parameters, rows: plain(nativeRows), eligibleRows: plain(eligibleRows) };
    const expected = replay?.records[records.length];
    if (replay) {
      assert(expected, 'Unrecorded SQL occurrence'); assert.equal(expected.sequence, sequence);
      assert.equal(expected.sql, sql); assert.deepEqual(expected.parameters, parameters);
    }
    const selected = replayCandidateSelection({ eligibleRows, nativeRows,
      recordedEligibleRows: expected?.eligibleRows || eligibleRows, recordedRows: expected?.rows || nativeRows });
    if (expected) row = expected;
    records.push(row);
    // The canonical call consumes rows only. Retain actual PG result metadata in
    // the wrapper, changing its projection to the same original ID row shape.
    return { ...result, rows: replay ? selected : nativeRows, rowCount: nativeRows.length };
  };
  return {
    wrapPool(pool) {
      const connect = pool.connect.bind(pool);
      pool.connect = async (...args) => {
        const client = await connect(...args);
        return new Proxy(client, { get(target, key) {
          if (key === 'query') return async (sql, values) => {
            const text = typeof sql === 'string' ? sql : sql.text;
            if (normalizedSql(text) !== QUERY_ORDER_SCOPE.sql) return target.query(sql, values);
            try {
              assert.equal(typeof sql, 'string', 'Unsupported query configuration for recorded selection');
              assert.equal(text, originalSql, 'Original population query bytes changed');
              assert.deepEqual(values ?? [], [], 'Original population query parameters changed');
              const result = await target.query(transformedSql);
              return observe(text, values, result);
            } catch (error) { failure ||= { message: error.message, stack: error.stack }; throw error; }
          };
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
      };
      return pool;
    },
    diagnostic() { return { format: 2, mode: replay ? 'recorded-selection-replay' : 'observe', scope: QUERY_ORDER_SCOPE,
      source: { original: source, sha256: sha256(source) }, records, arrivals, failure, recordsSha256: sha256(canonicalJson(records)) }; },
    finish() {
      assert(!failure, failure?.message);
      if (replay) assert.equal(records.length, replay.records.length, 'Unconsumed recorded SQL occurrences');
      return this.diagnostic();
    },
  };
}
