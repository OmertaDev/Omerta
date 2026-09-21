// Test-only recording of demonstrated unordered PostgreSQL selections/orders.
// No row can be replayed unless its complete eligible multiset still matches.
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
const populationScope = Object.freeze({
  id: 'population-jailbirds', kind: 'limited-projection', file: 'src/population.js', site: originalSql,
  source: 'src/population.js/runPopulationInner/JAILBIRDS',
  sourceSha256: '7a54934015fa68f99d008aca4699b168efc6b8e1c73dbccd8e3c9802396c151c',
  sql: normalizedSql(originalSql), originalSql, eligibleSql, transformedSql,
  originalSqlSha256: sha256(originalSql), transformedSqlSha256: sha256(transformedSql), limit: 24,
  reason: 'Native SQL leaves LIMIT membership and order unspecified before canonical Math.random indexing. Version 1 full replay failed at occurrence 269 because three candidate IDs changed.',
  permitted: 'Record the actual native limited result and complete eligible character rows in one PostgreSQL statement snapshot. Replay the observed subset/order only after exact eligible multiset equality including all values and duplicate multiplicities.',
  failClosed: 'Changed eligible membership, values, multiplicities, source, SQL, parameters, query count or selected cardinality fails. This records nondeterministic selection; it is not seed-only equivalence.' });
const standingColumns = ['kills', 'hitman_rep', 'boxing_wins', 'duel_wins', 'cartel_damage', 'soldiers_led',
  'tycoon_earned', 'laundered_lifetime', 'smuggled', 'product_moved', 'freight_delivered', 'heists_pulled',
  'statecraft', 'recruits', 'prestige', 'monument_built', 'prestige_sunk', 'race_wins', 'racer_wins',
  'caskets', 'intel_ops', 'honor_peak'];
const standingSite = `SELECT a.account_id, \${sel}, c.name, c.respect
       FROM account_persistent a
       JOIN characters c ON c.account_id = a.account_id AND c.alive
       JOIN accounts ac ON ac.id = a.account_id
      WHERE NOT a.agent_flag AND NOT a.npc_flag AND ac.status <> 'banned'`;
const standingSql = standingSite.replace('${sel}', standingColumns.map(c => `COALESCE(a.${c},0) AS ${c}`).join(', '));
const marketSql = "SELECT id, kind, seller_character, bidder FROM market_listings WHERE status='live' AND expires_at <= now()";
const marketEligibleSql = marketSql.replace('SELECT id, kind, seller_character, bidder ', 'SELECT * ');
const marketTransformedSql = `SELECT
  COALESCE((SELECT json_agg(rc1_selected) FROM (${marketSql}) rc1_selected), '[]'::json) AS limited_rows,
  COALESCE((SELECT json_agg(row_to_json(rc1_eligible)::text) FROM (${marketEligibleSql}) rc1_eligible), '[]'::json) AS eligible_rows`;
export const QUERY_ORDER_SCOPE = Object.freeze({ version: 4, storageFormat: 3,
  reason: 'Retained 90-day replay changed a tied seasonal champion and exchanged generated market refund/notification IDs. Record only the three exact demonstrated queries; no gameplay tiebreak or ID normalization.',
  queries: [populationScope, {
    id: 'standing-population', kind: 'complete-typed-rows', file: 'src/standing.js', site: standingSite,
    sourceSha256: 'e86fdd2ee3a24a01f37c28714bc79466edfe31a1b1d39d3af6a35c7f899b164b',
    originalSql: standingSql, sql: normalizedSql(standingSql), originalSqlSha256: sha256(standingSql),
    transformedSql: null, transformedSqlSha256: null,
    eligibility: 'Unchanged full canonical ranking input: every eligible returned row and column, with native pg types/numeric strings and duplicate multiplicities. No LIMIT or SQL rewriting.',
  }, {
    id: 'market-due', kind: 'complete-projection', file: 'src/market.js', site: marketSql,
    sourceSha256: 'ac65c72a32ce85e1e6cb5804a5c76c15e5d8f611ffab84122d6ddade1611fb40',
    originalSql: marketSql, sql: normalizedSql(marketSql), originalSqlSha256: sha256(marketSql),
    eligibleSql: marketEligibleSql, transformedSql: marketTransformedSql, transformedSqlSha256: sha256(marketTransformedSql),
    projection: ['id', 'kind', 'seller_character', 'bidder'],
    eligibility: 'One statement snapshot retains the unchanged original due projection plus every full eligible listing as exact PostgreSQL JSON text, including empty results.',
  }],
  failClosed: 'Exact source/query/parameters and complete eligible row multiset, values and multiplicities must match before any recorded ordering is returned. Earlier tape scope versions cannot qualify this scope.' });

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

export function replayCompleteProjection({ eligibleRows, nativeRows, recordedEligibleRows = eligibleRows, recordedRows = nativeRows, projection }) {
  replayRowOrder(eligibleRows, recordedEligibleRows);
  const projected = eligibleRows.map(text => {
    assert.equal(typeof text, 'string'); const row = JSON.parse(text);
    return Object.fromEntries(projection.map(key => {
      assert(Object.hasOwn(row, key)); assert(row[key] === null || typeof row[key] === 'string', 'Projection must preserve exact native string/null types');
      return [key, row[key]];
    }));
  });
  replayRowOrder(projected, nativeRows);
  return replayRowOrder(projected, recordedRows);
}

export function createRecordedQueryOrder({ replay = null, replayDirectory, artifact, root = new URL('../', import.meta.url) } = {}) {
  const sources = QUERY_ORDER_SCOPE.queries.map(scope => {
    const source = fs.readFileSync(new URL(scope.file, root), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(sha256(source), scope.sourceSha256, `${scope.id} query source differs from pinned source`);
    assert.equal(source.split(scope.site).length - 1, 1, `${scope.id} query instrumentation site differs`);
    return { file: scope.file, original: source, sha256: sha256(source) };
  });
  if (replay) {
    assert.equal(replay.format, 4); assert.deepEqual(replay.scope, QUERY_ORDER_SCOPE);
  }
  const writer = createQueryTapeWriter({ artifact });
  const reader = replay ? createQueryTapeReader({ manifest: replay.tape, directory: replayDirectory }) : null;
  let failure = null, accepted = 0;
  const observe = async (scope, sql, values, result) => {
    const parameters = plain(values ?? []), sequence = accepted + 1;
    const typed = scope.kind === 'complete-typed-rows';
    if (!typed) assert.equal(result.rows.length, 1, 'Recorded SQL snapshot wrapper must return one row');
    const nativeRows = typed ? result.rows : result.rows[0].limited_rows;
    const eligibleRows = typed ? null : result.rows[0].eligible_rows;
    const arrival = { sequence, queryId: scope.id, rows: plain(nativeRows), eligibleRows: plain(eligibleRows) };
    let expected = null;
    try {
      expected = reader ? await reader.next() : null;
      if (expected) {
        assert.equal(expected.sequence, sequence); assert.equal(expected.queryId, scope.id, 'Recorded query identity differs');
        assert.equal(expected.sql, sql, 'Recorded query SQL differs'); assert.deepEqual(expected.parameters, parameters);
      }
      const selection = { eligibleRows, nativeRows, recordedEligibleRows: expected?.eligibleRows || eligibleRows, recordedRows: expected?.rows || nativeRows };
      const selected = typed ? replayRowOrder(nativeRows, selection.recordedRows)
        : scope.kind === 'complete-projection' ? replayCompleteProjection({ ...selection, projection: scope.projection })
          : replayCandidateSelection(selection);
      const record = expected || { ...arrival, sql, parameters };
      await writer.append({ sequence, accepted: true, record, arrival }); accepted++;
      // Return actual native row objects for typed queries, preserving pg types.
      // Projection wrappers contain only their original string/null columns.
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
            const scope = QUERY_ORDER_SCOPE.queries.find(entry => normalizedSql(text) === entry.sql);
            if (!scope) return target.query(sql, values);
            try {
              assert.equal(typeof sql, 'string', 'Unsupported query configuration for recorded selection');
              assert.equal(text, scope.originalSql, 'Original recorded query bytes changed');
              assert.deepEqual(values ?? [], [], 'Original recorded query parameters changed');
              const result = await target.query(scope.transformedSql || sql);
              return await observe(scope, text, values, result);
            } catch (error) { failure ||= { message: error.message, stack: error.stack }; throw error; }
          };
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
      };
      return pool;
    },
    async diagnostic(complete = false) { return { format: 4, mode: replay ? 'recorded-selection-and-order-replay' : 'observe', scope: QUERY_ORDER_SCOPE,
      sources, failure, tape: await writer.manifest({ complete }) }; },
    async finish() {
      assert(!failure, failure?.message);
      if (reader) reader.finish();
      return this.diagnostic(true);
    },
  };
}
