// Test-only recording of one demonstrated unordered PostgreSQL LIMIT choice.
// No subset can be replayed unless its complete eligible state still matches.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { createQueryTapeWriter, createQueryTapeReader } from './rc1-native-query-tape.js';

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
export const QUERY_ORDER_SCOPE = Object.freeze({ version: 3,
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

export function createRecordedQueryOrder({ replay = null, replayDirectory, artifact, root = new URL('../', import.meta.url) } = {}) {
  const source = fs.readFileSync(new URL('src/population.js', root), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(sha256(source), QUERY_ORDER_SCOPE.sourceSha256, 'Population query source differs from pinned source');
  assert.equal(source.split(originalSql).length - 1, 1, 'Population query instrumentation site differs');
  if (replay) {
    assert.equal(replay.format, 3); assert.deepEqual(replay.scope, QUERY_ORDER_SCOPE);
  }
  const writer = createQueryTapeWriter({ artifact });
  const reader = replay ? createQueryTapeReader({ manifest: replay.tape, directory: replayDirectory }) : null;
  let failure = null, accepted = 0;
  const observe = async (sql, values, result) => {
    const parameters = plain(values ?? []), sequence = accepted + 1;
    assert.equal(result.rows.length, 1, 'Recorded SQL snapshot wrapper must return one row');
    const { limited_rows: nativeRows, eligible_rows: eligibleRows } = result.rows[0];
    const arrival = { sequence, rows: plain(nativeRows), eligibleRows: plain(eligibleRows) };
    let expected = null;
    try {
      expected = reader ? await reader.next() : null;
      if (expected) {
        assert.equal(expected.sequence, sequence); assert.equal(expected.sql, sql); assert.deepEqual(expected.parameters, parameters);
      }
      const selected = replayCandidateSelection({ eligibleRows, nativeRows,
        recordedEligibleRows: expected?.eligibleRows || eligibleRows, recordedRows: expected?.rows || nativeRows });
      const record = expected || { ...arrival, sql, parameters };
      await writer.append({ sequence, accepted: true, record, arrival }); accepted++;
      // The canonical call consumes rows only. Its selected ID projection is
      // retained; every native full-state observation is streamed to the tape.
      return { ...result, rows: replay ? selected : nativeRows, rowCount: nativeRows.length };
    } catch (error) {
      await writer.append({ sequence, accepted: false, record: expected, arrival,
        error: { message: error.message, stack: error.stack } });
      throw error;
    }
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
              return await observe(text, values, result);
            } catch (error) { failure ||= { message: error.message, stack: error.stack }; throw error; }
          };
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
      };
      return pool;
    },
    async diagnostic(complete = false) { return { format: 3, mode: replay ? 'recorded-selection-replay' : 'observe', scope: QUERY_ORDER_SCOPE,
      source: { original: source, sha256: sha256(source) }, failure, tape: await writer.manifest({ complete }) }; },
    async finish() {
      assert(!failure, failure?.message);
      if (reader) reader.finish();
      return this.diagnostic(true);
    },
  };
}
