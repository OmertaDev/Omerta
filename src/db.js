// DB layer: real Postgres when DATABASE_URL is set, in-memory pg-mem otherwise.
// pg-mem mode means `npm start` works with ZERO infrastructure — for Jorge and for CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// What the live driver can actually do, decided ONCE at makeDb (a driver property, not a per-call
// one). Deliberately NOT a runtime probe: in real Postgres a failed statement aborts the ENCLOSING
// transaction (25P02), so probing an unsupported feature mid-txn would poison it — the same class
// the recordRival/recordContact SAVEPOINT lessons cover. `skipLocked` is false under pg-mem, which
// parses neither SKIP LOCKED nor NOWAIT; callers must keep a fallback that is CORRECT on its own
// terms (never a silently different outcome — only a different blocking posture).
// Defaults are correctness-first fallbacks. Real Postgres capabilities turn on only after its schema
// boot succeeds; an unknown/custom query adapter therefore gets portable SQL rather than a fast shape
// whose semantics pg-mem is known to mis-execute.
export const dbCaps = { skipLocked: false, indexedTextArrayAny: false };

// Register only the PostgreSQL built-ins that H1's literal schema needs and pg-mem omits. Callers
// that create a raw pg-mem database for schema tests must opt in before applying schema.sql; the
// real-Postgres branch never calls this compatibility registrar.
export function registerPgMemCompatibility(mem, DataType) {
  mem.public.registerFunction({
    name: 'translate', args: [DataType.text, DataType.text, DataType.text], returns: DataType.text,
    implementation: (value, from, to) => {
      const source = Array.from(from), target = Array.from(to);
      return Array.from(value, (character) => {
        const index = source.indexOf(character);
        return index < 0 ? character : (target[index] ?? '');
      }).join('');
    },
  });
  mem.public.registerFunction({
    name: 'char_length', args: [DataType.text], returns: DataType.integer,
    implementation: (value) => Array.from(value).length,
  });
  mem.public.registerFunction({
    name: 'octet_length', args: [DataType.bytea], returns: DataType.integer,
    implementation: (value) => Buffer.byteLength(value),
  });
}

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
// A fixed key for the boot-time schema advisory lock (any constant bigint — must match across processes).
const SCHEMA_LOCK_KEY = 918273645;

// ── THE SCHEMA STAMP (bulletproof audit, Schema Versioning) ─────────────────────────────────────
// schema.sql is additive-only and applied idempotently at every boot — which is exactly why "which
// schema is prod on?" was unanswerable during an incident: nothing in the DATABASE recorded who
// applied it last. One row now does. The stamp also makes a ROLLBACK visible: an OLDER build booting
// against a database a NEWER build already migrated is survivable BY the additive-only discipline,
// but it should never be silent — that is usually somebody rolling back a bad deploy, and the warning
// names the runbook. An older build deliberately does NOT overwrite the newer stamp (the row records
// the newest build that touched the schema; overwriting would silence the warning on the next boot).
const newerVersion = (a, b) => { // true when semver-ish `a` > `b`
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};
export async function stampSchema(q) {
  const appVer = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8')).version || '0.0.0';
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(SCHEMA).digest('hex').slice(0, 16);
  const prev = (await q.query('SELECT app_version FROM schema_meta WHERE id=1')).rows[0];
  if (prev && newerVersion(prev.app_version, appVer)) {
    console.warn(`[db] ⚠ this build (v${appVer}) is OLDER than the build that last migrated this database (v${prev.app_version}) — likely a rollback in progress. Additive-only schema discipline makes this safe to run; see DEPLOY.md § Rolling back a bad deploy.`);
    return { appVer, sha, rolledBack: true };
  }
  // UPDATE-then-INSERT, never ON CONFLICT (the recordReckoning pg-mem lesson: DO NOTHING lies about rowCount)
  const upd = await q.query('UPDATE schema_meta SET app_version=$1, schema_sha=$2, applied_at=now() WHERE id=1', [appVer, sha]);
  if (!upd.rowCount) await q.query('INSERT INTO schema_meta (id, app_version, schema_sha) VALUES (1,$1,$2)', [appVer, sha]);
  return { appVer, sha, rolledBack: false };
}

// (red-team R30 MED-1 — the in-place-upgrade migration) schema.sql is 100% `CREATE TABLE IF NOT EXISTS`,
// so on an ALREADY-created Postgres DB every column added to a table's CREATE block AFTER that table first
// existed is silently absent — an in-place upgrade then 500s on every path that names a new column. This
// derives an idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` set FROM the schema text itself (so it can
// never drift from schema.sql and auto-covers every future column), then runs it after the schema applies.
// Parsing rule: for each `CREATE TABLE [IF NOT EXISTS] <t> ( … )`, each body line that is a COLUMN (not a
// table-level PRIMARY KEY/UNIQUE/FOREIGN/CHECK/CONSTRAINT line) becomes an ADD COLUMN. Column-level
// PRIMARY KEY/UNIQUE/REFERENCES are stripped from the generated def — those only sit on ORIGINAL columns,
// which IF NOT EXISTS no-ops anyway, so keeping only `TYPE [NOT NULL] [DEFAULT …]` makes the ALTER always safe.
export function columnMigrations(schemaText) {
  const clean = schemaText.replace(/--[^\n]*/g, ''); // strip line comments first (a `)` inside a comment must not close the paren scan)
  const out = [];
  const head = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let m;
  while ((m = head.exec(clean))) {
    const table = m[1];
    // paren-depth scan from just after the opening '(' to its matching ')' — correct for single-line
    // tables (`… TEXT );`), `now()`/`DEFAULT (…)` inner parens, and multi-line bodies alike.
    let depth = 1, body = '', i = head.lastIndex;
    for (; i < clean.length && depth > 0; i++) {
      const ch = clean[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      body += ch;
    }
    head.lastIndex = i; // resume the outer scan past this table's body
    // split the body into column/constraint defs on TOP-LEVEL commas (a comma inside (…) — PRIMARY KEY
    // (a,b), NUMERIC(10,2) — stays with its piece), so multiple columns on one line are each their own def.
    const pieces = [];
    let d = 0, cur = '';
    for (const ch of body) {
      if (ch === '(') { d++; cur += ch; } else if (ch === ')') { d--; cur += ch; }
      else if (ch === ',' && d === 0) { pieces.push(cur); cur = ''; } else cur += ch;
    }
    pieces.push(cur);
    for (const raw of pieces) {
      const line = raw.replace(/\s+/g, ' ').trim(); // collapse newlines/whitespace into one clean line
      if (!line) continue;
      if (/^(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|CONSTRAINT|EXCLUDE|LIKE)\b/i.test(line)) continue; // table-level constraint, not a column
      const col = line.match(/^"?([A-Za-z_][A-Za-z0-9_]*)"?\s+(.+)$/);
      if (!col) continue;
      const def = col[2]
        .replace(/\s+PRIMARY\s+KEY\b/i, '')
        .replace(/\s+UNIQUE\b/i, '')
        .replace(/\s+REFERENCES\s+[A-Za-z0-9_]+\s*(\([^)]*\))?/i, '')
        .replace(/\s+ON\s+(?:DELETE|UPDATE)\s+(?:NO\s+ACTION|RESTRICT|CASCADE|SET\s+NULL|SET\s+DEFAULT)\b/gi, '')
        .trim();
      if (def) out.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col[1]} ${def}`);
    }
  }
  return out;
}

// Run the derived ADD-COLUMN migration, each statement isolated (a single failure — e.g. a genuinely
// later-added NOT-NULL-without-default column on a populated table — is logged and skipped, never bricks
// boot). `ADD COLUMN IF NOT EXISTS` is a clean no-op when the column already exists (the common case), so
// this is safe to run on every boot, fresh or upgraded.
export async function migrateColumns(pool, schemaText = SCHEMA) {
  const stmts = columnMigrations(schemaText);
  let failed = 0;
  for (const s of stmts) {
    try { await pool.query(s); }
    catch (e) { failed++; console.error('[migrate] skipped:', s, '—', e?.message?.slice(0, 140)); }
  }
  return { total: stmts.length, failed };
}

const TASK5_DECISION_TUPLE_SQL = `(
  (status = 'closed_ready' AND (
    (decided_by = 'chamber' AND decided_by_code = 1
      AND votes BETWEEN 1 AND 5 AND weighted BETWEEN 1 AND 15)
    OR (decided_by = 'default_silence' AND decided_by_code = 2
      AND votes = 0 AND weighted = 0)
    OR (decided_by = 'default_tie' AND decided_by_code = 3
      AND votes = 0 AND weighted = 0)
  ))
  OR (status = 'skipped_catalog_unavailable' AND decided_by = 'skipped'
    AND decided_by_code = 4 AND skip_reason = 'catalog_unavailable'
    AND votes = 0 AND weighted = 0)
  OR (status = 'skipped_catalog_empty' AND decided_by = 'skipped'
    AND decided_by_code = 5 AND skip_reason = 'catalog_empty'
    AND votes = 0 AND weighted = 0)
  OR (status = 'skipped_no_valid_candidate' AND decided_by = 'skipped'
    AND decided_by_code = 6 AND skip_reason = 'no_valid_candidate'
    AND votes = 0 AND weighted = 0)
)`;

const TASK5_CLOSED_TUPLE_SQL = `(
  (closed_valid IS NULL AND closed_counted IS NULL AND closed_weight IS NULL
    AND closed_exclusion_reason IS NULL)
  OR
  (closed_valid IS NOT NULL AND closed_counted IS NOT NULL AND closed_weight IS NOT NULL
    AND (
      (closed_valid AND closed_counted AND closed_weight BETWEEN 1 AND 5
        AND closed_exclusion_reason IS NULL)
      OR (closed_valid AND NOT closed_counted AND closed_weight = 0
        AND closed_exclusion_reason = 'outside_top_five')
      OR (NOT closed_valid AND NOT closed_counted AND closed_weight = 0
        AND closed_exclusion_reason IS NOT NULL)
    ))
)`;

const canonicalBytes32Sql = (column) => `(${column} LIKE '0x${'_'.repeat(64)}'
  AND ${Array.from({ length: 64 }, (_, index) => (
    `substring(${column},${index + 3},1) IN ('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f')`
  )).join('\n  AND ')})`;

const TASK5_PUBLICATION_TUPLE_SQL = `(
  (registry_tx_hash IS NULL OR ${canonicalBytes32Sql('registry_tx_hash')})
  AND (finalized_block_number IS NULL OR finalized_block_number >= 0)
  AND (finalized_block_hash IS NULL OR ${canonicalBytes32Sql('finalized_block_hash')})
  AND (
    (status <> 'closed_ready'
      AND publication_status = 'not_submitted'
      AND registry_tx_hash IS NULL
      AND finalized_block_number IS NULL
      AND finalized_block_hash IS NULL
      AND finalized_at IS NULL)
    OR
    (status = 'closed_ready' AND (
      (publication_status = 'not_submitted'
        AND registry_tx_hash IS NULL
        AND finalized_block_number IS NULL
        AND finalized_block_hash IS NULL
        AND finalized_at IS NULL)
      OR (publication_status IN ('publisher_submitted','published_pending_finality')
        AND registry_tx_hash IS NOT NULL
        AND finalized_block_number IS NULL
        AND finalized_block_hash IS NULL
        AND finalized_at IS NULL)
      OR (publication_status = 'finalized'
        AND registry_tx_hash IS NOT NULL
        AND finalized_block_number IS NOT NULL
        AND finalized_block_hash IS NOT NULL
        AND finalized_at IS NOT NULL)
      OR (publication_status = 'reorged'
        AND registry_tx_hash IS NOT NULL
        AND finalized_block_number IS NULL
        AND finalized_block_hash IS NULL
        AND finalized_at IS NULL)
      OR (publication_status = 'failed'
        AND finalized_block_number IS NULL
        AND finalized_block_hash IS NULL
        AND finalized_at IS NULL)
    ))
  )
)`;

const TASK5_BALLOT_CONSTRAINTS = [
  ['ticker_ballot_days_v2', 'ck_ticker_ballot_days_v2_day_range',
    'day >= 0 AND day <= 99999999'],
  ['ticker_ballot_candidates_v2', 'ck_ticker_ballot_candidates_v2_day_range',
    'day >= 0 AND day <= 99999999'],
  ['commission_ticker_votes_v2', 'ck_commission_ticker_votes_v2_day_range',
    'day >= 0 AND day <= 99999999'],
  ['ticker_ballot_results_v2', 'ck_ticker_ballot_results_v2_day_range',
    'day >= 0 AND day <= 99999999'],
  ['ticker_ballot_candidates_v2', 'ck_ticker_ballot_candidates_v2_activation_evidence',
    "activation_evidence_version = 0 OR (activation_evidence_version = 1 AND activated_at IS NOT NULL)"],
  ['commission_ticker_votes_v2', 'ck_commission_ticker_votes_v2_closed_tuple',
    TASK5_CLOSED_TUPLE_SQL],
  ['ticker_ballot_results_v2', 'ck_ticker_ballot_results_v2_vote_evidence_version',
    'vote_evidence_version IN (0,1)'],
  ['ticker_ballot_results_v2', 'ck_ticker_ballot_results_v2_decision_tuple',
    TASK5_DECISION_TUPLE_SQL],
  ['ticker_ballot_results_v2', 'ck_ticker_ballot_results_v2_publication_tuple',
    TASK5_PUBLICATION_TUPLE_SQL],
];

async function task5BallotColumns(q) {
  const rows = (await q.query(
    `SELECT table_name,column_name FROM information_schema.columns
      WHERE table_name IN ('ticker_ballot_candidates_v2','commission_ticker_votes_v2',
                           'ticker_ballot_results_v2')`,
  )).rows;
  return new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
}

async function rejectInvalidTask5BallotAuthority(q, columns) {
  const checks = [
    ...['ticker_ballot_days_v2', 'ticker_ballot_candidates_v2',
      'commission_ticker_votes_v2', 'ticker_ballot_results_v2'].map((table) => ({
      label: `${table} day range`,
      sql: `SELECT 1 FROM ${table} WHERE day < 0 OR day > 99999999 LIMIT 1`,
    })),
    {
      label: 'result decision tuple',
      sql: `SELECT 1 FROM ticker_ballot_results_v2 WHERE NOT ${TASK5_DECISION_TUPLE_SQL} LIMIT 1`,
    },
    {
      label: 'result publication tuple',
      sql: `SELECT 1 FROM ticker_ballot_results_v2 WHERE NOT ${TASK5_PUBLICATION_TUPLE_SQL} LIMIT 1`,
    },
  ];
  if (columns.has('ticker_ballot_candidates_v2.activation_evidence_version')
      && columns.has('ticker_ballot_candidates_v2.activated_at')) checks.push({
    label: 'candidate activation evidence tuple',
    sql: `SELECT 1 FROM ticker_ballot_candidates_v2
           WHERE NOT (activation_evidence_version = 0
             OR (activation_evidence_version = 1 AND activated_at IS NOT NULL)) LIMIT 1`,
  });
  if (['closed_valid', 'closed_counted', 'closed_weight', 'closed_exclusion_reason'].every(
    (column) => columns.has(`commission_ticker_votes_v2.${column}`),
  )) checks.push({
    label: 'closed vote tuple',
    sql: `SELECT 1 FROM commission_ticker_votes_v2 WHERE NOT ${TASK5_CLOSED_TUPLE_SQL} LIMIT 1`,
  });
  if (columns.has('ticker_ballot_results_v2.vote_evidence_version')) checks.push({
    label: 'result vote evidence version',
    sql: `SELECT 1 FROM ticker_ballot_results_v2
           WHERE vote_evidence_version NOT IN (0,1) LIMIT 1`,
  });
  for (const check of checks) {
    if ((await q.query(check.sql)).rows.length) {
      const error = new Error(`Task 5 authority migration rejected invalid legacy ${check.label}`);
      error.code = 'task5_migration_invalid';
      throw error;
    }
  }
}

async function addTask5BallotConstraint(q, table, name, expression, compatibility) {
  if (compatibility === 'pg-mem') {
    try {
      await q.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression})`);
    }
    catch (error) {
      if (error?.code !== '42P07') throw error;
    }
    return;
  }
  const exists = (await q.query(
    'SELECT 1 FROM pg_constraint WHERE conname=$1 AND conrelid=$2::regclass', [name, table],
  )).rows.length > 0;
  if (!exists) await q.query(
    `ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression}) NOT VALID`,
  );
  await q.query(`ALTER TABLE ${table} VALIDATE CONSTRAINT ${name}`);
}

// Targeted authority migration for the four already-shipped Task 5 tables. Unlike the generic
// log-and-skip column pass, this transaction is deliberately fail-closed: version-zero is the only
// truthful interpretation of legacy candidate/result evidence, and every authority constraint must
// validate before startup may stamp the schema. `pg-mem` lacks NOT VALID/VALIDATE and transactional
// DDL; its narrow adapter uses the same CHECK expressions while production retains PostgreSQL DDL.
export async function migrateTask5BallotV2(q, { compatibility = 'postgres' } = {}) {
  await q.query('BEGIN');
  try {
    await q.query('SELECT 1 AS ok /* task5_ballot_v2_targeted_migration */');
    if (compatibility === 'postgres') await q.query(
      `LOCK TABLE ticker_ballot_days_v2,ticker_ballot_candidates_v2,
                  commission_ticker_votes_v2,ticker_ballot_results_v2
         IN ACCESS EXCLUSIVE MODE`,
    );
    const before = await task5BallotColumns(q);
    await rejectInvalidTask5BallotAuthority(q, before);
    for (const statement of [
      'ALTER TABLE ticker_ballot_candidates_v2 ADD COLUMN IF NOT EXISTS activation_evidence_version SMALLINT NOT NULL DEFAULT 0',
      'ALTER TABLE ticker_ballot_candidates_v2 ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ',
      'ALTER TABLE commission_ticker_votes_v2 ADD COLUMN IF NOT EXISTS closed_valid BOOLEAN',
      'ALTER TABLE commission_ticker_votes_v2 ADD COLUMN IF NOT EXISTS closed_counted BOOLEAN',
      'ALTER TABLE commission_ticker_votes_v2 ADD COLUMN IF NOT EXISTS closed_weight INT',
      'ALTER TABLE commission_ticker_votes_v2 ADD COLUMN IF NOT EXISTS closed_exclusion_reason TEXT',
      'ALTER TABLE ticker_ballot_results_v2 ADD COLUMN IF NOT EXISTS vote_evidence_version SMALLINT NOT NULL DEFAULT 0',
    ]) await q.query(statement);
    const after = await task5BallotColumns(q);
    await rejectInvalidTask5BallotAuthority(q, after);
    for (const constraint of TASK5_BALLOT_CONSTRAINTS) {
      await addTask5BallotConstraint(q, ...constraint, compatibility);
    }
    await q.query('COMMIT');
  } catch (error) {
    await q.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

const RWA_HEALTH_H2_FOREIGN_KEYS = Object.freeze([
  Object.freeze({
    table: 'rwa_health_episodes_v2',
    name: 'fk_rwa_health_episode_h2_clearance_v2',
    source: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id', 'generation',
      'clearance_generation', 'clearance_block_number', 'clearance_block_hash',
      'clearance_applied_at',
    ]),
    referenced: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'h1_clearance_generation', 'execution_block_number',
      'execution_block_hash', 'finalized_applied_at',
    ]),
  }),
  Object.freeze({
    table: 'rwa_health_episode_events_v2',
    name: 'fk_rwa_health_event_h2_clearance_v2',
    source: Object.freeze([
      'source_clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'event_id', 'evidence_hash',
    ]),
    referenced: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'h1_clearance_event_id', 'recovery_evidence_hash',
    ]),
  }),
  Object.freeze({
    table: 'rwa_health_current_v2',
    name: 'fk_rwa_health_current_h2_clearance_v2',
    source: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'current_episode_id',
      'current_episode_generation', 'clearance_generation', 'clearance_applied_at',
      'latest_episode_event_id',
    ]),
    referenced: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'h1_clearance_generation', 'finalized_applied_at',
      'h1_clearance_event_id',
    ]),
  }),
]);

const H2_FINALIZED_TABLE = 'rwa_health_finalized_clearances_v2';

function h2ForeignKeyDefinition(spec) {
  return `FOREIGN KEY (${spec.source.join(',')}) REFERENCES ${H2_FINALIZED_TABLE} `
    + `(${spec.referenced.join(',')}) ON DELETE RESTRICT`;
}

function canonicalConstraintDefinition(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('"', '')
    .replace(/\bpublic\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .trim();
}

function h2MigrationError(detail) {
  const error = new Error(`RWA health H2 authority migration rejected ${detail}`);
  error.code = 'rwa_health_overlay_migration_invalid';
  return error;
}

// `pg_attribute.attname` is Postgres type `name`, so an ARRAY() over it comes back as `name[]`
// (OID 1003) — and node-pg ships an array parser for `text[]` (1009) and not for that one, so a
// perfectly valid column list arrives as the raw literal string "{a,b}" and `Array.isArray` is
// false. The verifier then reports a DRIFTED constraint on a constraint that is exactly right, and
// because it is fail-closed that takes the whole boot down: every real-Postgres harness opens a
// database, so one unparsed array reads as five separate harness failures. The `::text` cast is the
// same one its five sibling projections above already carry (`contype`, `confdeltype`,
// `confrelid::regclass`) — this was the forgotten sibling, not a new rule.
async function readH2ForeignKey(q, spec) {
  const rows = (await q.query(
    `SELECT c.conname,c.contype::text AS contype,c.convalidated,
            c.confdeltype::text AS confdeltype,
            pg_get_constraintdef(c.oid,true) AS definition,
            c.confrelid::regclass::text AS referenced_table,
            -- ::text is load-bearing, not decoration. pg_attribute.attname has SQL type name,
            -- so a bare ARRAY(...) of it is name[] (OID 1003) and node-postgres registers no
            -- array parser for that OID: the driver hands back the raw literal {a,b,c} as a
            -- STRING, exactStringArray's Array.isArray fails, and every boot against real
            -- PostgreSQL dies on a drifted-constraint refusal that never drifted. text[]
            -- (OID 1009) the driver does parse. No backticks in this comment: it sits inside a
            -- JS template literal.
            ARRAY(
              SELECT a.attname::text
                FROM unnest(c.conkey) WITH ORDINALITY AS key_column(attnum,ordinality)
                JOIN pg_attribute a
                  ON a.attrelid=c.conrelid AND a.attnum=key_column.attnum
               ORDER BY key_column.ordinality
            ) AS source_columns,
            ARRAY(
              SELECT a.attname::text
                FROM unnest(c.confkey) WITH ORDINALITY AS key_column(attnum,ordinality)
                JOIN pg_attribute a
                  ON a.attrelid=c.confrelid AND a.attnum=key_column.attnum
               ORDER BY key_column.ordinality
            ) AS referenced_columns
       FROM pg_constraint c
      WHERE c.conname=$1 AND c.conrelid=$2::regclass`,
    [spec.name, spec.table],
  )).rows;
  if (rows.length > 1) throw h2MigrationError(`duplicate constraint ${spec.name}`);
  return rows[0] ?? null;
}

function exactStringArray(value, expected) {
  return Array.isArray(value) && value.length === expected.length
    && value.every((entry, index) => String(entry) === expected[index]);
}

function verifyH2ForeignKey(row, spec, { requireValidated }) {
  // Name every field that drifted rather than only the constraint. A bare `drifted constraint X`
  // is a fail-closed refusal with nothing in it for the operator: the six conditions below fail
  // for entirely different reasons, and telling them apart is otherwise a manual pg_constraint
  // read against a database that will not boot.
  const drift = [];
  if (!row) drift.push('missing');
  else {
    if (row.contype !== 'f') drift.push('type');
    if (String(row.referenced_table).replace(/^public\./, '') !== H2_FINALIZED_TABLE) {
      drift.push('referenced_table');
    }
    if (row.confdeltype !== 'r') drift.push('delete_action');
    if (!exactStringArray(row.source_columns, spec.source)) drift.push('source_columns');
    if (!exactStringArray(row.referenced_columns, spec.referenced)) drift.push('referenced_columns');
    if (canonicalConstraintDefinition(row.definition)
        !== canonicalConstraintDefinition(h2ForeignKeyDefinition(spec))) {
      drift.push('definition');
    }
  }
  if (drift.length) {
    throw h2MigrationError(`drifted constraint ${spec.name} fields=${drift.join(',')}`);
  }
  if (requireValidated && row.convalidated !== true) {
    throw h2MigrationError(`unvalidated constraint ${spec.name}`);
  }
  if (!requireValidated && row.convalidated !== false) {
    throw h2MigrationError(`new constraint ${spec.name} had unexpected validation state`);
  }
}

// Existing H1 tables predate H2. CREATE TABLE IF NOT EXISTS cannot retrofit their three
// authority FKs, and the generic ADD-COLUMN lane deliberately cannot add table constraints.
// Production therefore freezes all four participating tables and installs each missing FK as
// NOT VALID, verifies its literal definition/column order, validates all legacy rows, then
// verifies convalidated=true before the outer boot path may stamp the schema. A pre-existing
// name-only, drifted, or unvalidated constraint is not repaired in place: it is evidence of an
// unknown migration and startup fails closed. pg-mem cannot expose pg_constraint faithfully or
// parse NOT VALID/VALIDATE; its explicit compatibility result is test scaffolding, never claimed
// as PostgreSQL migration evidence.
export async function migrateRwaHealthOverlayV2(q, { compatibility = 'postgres' } = {}) {
  await q.query('BEGIN');
  try {
    await q.query('SELECT 1 AS ok /* rwa_health_overlay_v2_targeted_migration */');
    if (compatibility === 'pg-mem') {
      await q.query('COMMIT');
      return Object.freeze({ compatibility: 'pg-mem', verified: false, installed: 0 });
    }
    if (compatibility !== 'postgres') throw h2MigrationError('unknown compatibility mode');
    await q.query(
      `LOCK TABLE rwa_health_finalized_clearances_v2,rwa_health_episodes_v2,
                  rwa_health_episode_events_v2,rwa_health_current_v2
         IN ACCESS EXCLUSIVE MODE`,
    );
    let installed = 0;
    for (const spec of RWA_HEALTH_H2_FOREIGN_KEYS) {
      const existing = await readH2ForeignKey(q, spec);
      if (existing) {
        verifyH2ForeignKey(existing, spec, { requireValidated: true });
        continue;
      }
      await q.query(
        `ALTER TABLE ${spec.table} ADD CONSTRAINT ${spec.name} `
          + `${h2ForeignKeyDefinition(spec)} NOT VALID`,
      );
      verifyH2ForeignKey(await readH2ForeignKey(q, spec), spec, { requireValidated: false });
      await q.query(`ALTER TABLE ${spec.table} VALIDATE CONSTRAINT ${spec.name}`);
      verifyH2ForeignKey(await readH2ForeignKey(q, spec), spec, { requireValidated: true });
      installed++;
    }
    await q.query('COMMIT');
    return Object.freeze({ compatibility: 'postgres', verified: true, installed });
  } catch (error) {
    await q.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

// Called only while makeDb holds the existing session advisory lock. Keeping the sequence in one
// tested seam prevents a future boot edit from stamping a build before its fail-closed authority
// migration completed.
export async function migrateSchemaUnderLock(
  boot, { schemaText = SCHEMA, compatibility = 'postgres' } = {},
) {
  await boot.query(schemaText);
  await verifyPhase2DefinitionSchema(boot, { compatibility });
  const migration = await migrateColumns(boot, schemaText);
  await migrateTask5BallotV2(boot, { compatibility });
  await migrateRwaHealthOverlayV2(boot, { compatibility });
  const stamp = await stampSchema(boot);
  return { migration, stamp };
}

// Literal Phase 2 shape contract. CHECK definitions use PostgreSQL's canonical deparser form;
// preserving parentheses, casts and literal strings detects semantic drift, not merely names.
const PHASE2_SCHEMA_CONTRACT = [
  {
    table: 'content_bundle_artifacts',
    columns: [
      ["bundle_hash","text",true,null],
      ["namespace","text",true,null],
      ["bundle_version","bigint",true,null],
      ["artifact_format_version","integer",true,null],
      ["compiler_version","text",true,null],
      ["ir_version","integer",true,null],
      ["authored_kind","text",true,null],
      ["package_kind","text",true,null],
      ["profile","text",true,null],
      ["authority_profile","text",true,null],
      ["activatable","boolean",true,null],
      ["source_hash","text",true,null],
      ["secret_overlay_hash","text",true,null],
      ["dependency_lock_hash","text",true,null],
      ["ir_hash","text",true,null],
      ["public_manifest_hash","text",true,null],
      ["report_hashes_json","text",true,null],
      ["definition_count","integer",true,null],
      ["canonical_bytes","bytea",true,null],
      ["registered_by","text",true,null],
      ["registered_at","timestamp with time zone",true,"now()"],
    ],
    constraints: [
      {"name":"p2_artifact_pk","type":"p","definition":"PRIMARY KEY (bundle_hash)"},
      {"name":"p2_artifact_namespace_version_uq","type":"u","definition":"UNIQUE (namespace, bundle_version)"},
      {"name":"p2_artifact_namespace_hash_uq","type":"u","definition":"UNIQUE (namespace, bundle_hash)"},
      {"name":"p2_artifact_namespace_hash_lock_uq","type":"u","definition":"UNIQUE (namespace, bundle_hash, dependency_lock_hash)"},
      {"name":"p2_artifact_bundle_hash_ck","type":"c","definition":"CHECK (char_length(bundle_hash) = 64 AND bundle_hash = lower(bundle_hash) AND translate(bundle_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_artifact_source_hash_ck","type":"c","definition":"CHECK (char_length(source_hash) = 64 AND source_hash = lower(source_hash) AND translate(source_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_artifact_secret_overlay_hash_ck","type":"c","definition":"CHECK (char_length(secret_overlay_hash) = 64 AND secret_overlay_hash = lower(secret_overlay_hash) AND translate(secret_overlay_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_artifact_dependency_lock_hash_ck","type":"c","definition":"CHECK (char_length(dependency_lock_hash) = 64 AND dependency_lock_hash = lower(dependency_lock_hash) AND translate(dependency_lock_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_artifact_ir_hash_ck","type":"c","definition":"CHECK (char_length(ir_hash) = 64 AND ir_hash = lower(ir_hash) AND translate(ir_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_artifact_public_manifest_hash_ck","type":"c","definition":"CHECK (char_length(public_manifest_hash) = 64 AND public_manifest_hash = lower(public_manifest_hash) AND translate(public_manifest_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_artifact_bundle_version_ck","type":"c","definition":"CHECK (bundle_version >= 1 AND bundle_version <= '9007199254740991'::bigint)"},
      {"name":"p2_artifact_namespace_ck","type":"c","definition":"CHECK (char_length(namespace) >= 1 AND char_length(namespace) <= 128)"},
      {"name":"p2_artifact_compiler_version_ck","type":"c","definition":"CHECK (char_length(compiler_version) >= 1 AND char_length(compiler_version) <= 64)"},
      {"name":"p2_artifact_registered_by_ck","type":"c","definition":"CHECK (char_length(registered_by) >= 1 AND char_length(registered_by) <= 200)"},
      {"name":"p2_artifact_artifact_format_version_ck","type":"c","definition":"CHECK (artifact_format_version = 1)"},
      {"name":"p2_artifact_ir_version_ck","type":"c","definition":"CHECK (ir_version = 1)"},
      {"name":"p2_artifact_authored_kind_ck","type":"c","definition":"CHECK (authored_kind IN ('library'::text, 'experience'::text))"},
      {"name":"p2_artifact_package_kind_ck","type":"c","definition":"CHECK (package_kind IN ('library'::text, 'experience'::text, 'fixture'::text))"},
      {"name":"p2_artifact_profile_ck","type":"c","definition":"CHECK (profile = 'phase2_economy'::text)"},
      {"name":"p2_artifact_authority_profile_ck","type":"c","definition":"CHECK (authority_profile IN ('production'::text, 'fixture'::text))"},
      {"name":"p2_artifact_activatable_ck","type":"c","definition":"CHECK (authority_profile = 'production'::text AND package_kind = authored_kind AND activatable = (authored_kind = 'experience'::text) OR authority_profile = 'fixture'::text AND package_kind = 'fixture'::text AND activatable = false)"},
      {"name":"p2_artifact_definition_count_ck","type":"c","definition":"CHECK (definition_count >= 0 AND definition_count <= 20000)"},
      {"name":"p2_artifact_canonical_bytes_ck","type":"c","definition":"CHECK (octet_length(canonical_bytes) >= 1 AND octet_length(canonical_bytes) <= 67108864)"},
    ],
  },
  {
    table: 'item_definition_versions',
    columns: [
      ["definition_hash","text",true,null],
      ["logical_item_id","text",true,null],
      ["definition_version","bigint",true,null],
      ["package_id","text",true,null],
      ["definition_kind","text",true,null],
      ["family","text",false,null],
      ["tags_json","text",false,null],
      ["rarity","text",false,null],
      ["stackable","boolean",false,null],
      ["trade_mode","text",false,null],
      ["transferable","boolean",false,null],
      ["trade_policy_hash","text",false,null],
      ["owner_scopes_json","text",false,null],
      ["quality_mode","text",false,null],
      ["maximum_lot_quantity","integer",false,null],
      ["conservation_class","text",false,null],
      ["metadata_json","text",false,null],
      ["canonical_definition_bytes","bytea",true,null],
      ["registered_at","timestamp with time zone",true,"now()"],
    ],
    constraints: [
      {"name":"p2_definition_pk","type":"p","definition":"PRIMARY KEY (definition_hash)"},
      {"name":"p2_definition_id_version_uq","type":"u","definition":"UNIQUE (logical_item_id, definition_version)"},
      {"name":"p2_definition_id_hash_uq","type":"u","definition":"UNIQUE (logical_item_id, definition_hash)"},
      {"name":"p2_definition_definition_hash_ck","type":"c","definition":"CHECK (char_length(definition_hash) = 64 AND definition_hash = lower(definition_hash) AND translate(definition_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_definition_version_ck","type":"c","definition":"CHECK (definition_version >= 1 AND definition_version <= '9007199254740991'::bigint)"},
      {"name":"p2_definition_logical_item_id_ck","type":"c","definition":"CHECK (char_length(logical_item_id) >= 1 AND char_length(logical_item_id) <= 258)"},
      {"name":"p2_definition_package_id_ck","type":"c","definition":"CHECK (char_length(package_id) >= 1 AND char_length(package_id) <= 128)"},
      {"name":"p2_definition_kind_ck","type":"c","definition":"CHECK (definition_kind IN ('concept'::text, 'material'::text, 'item'::text))"},
      {"name":"p2_definition_rarity_ck","type":"c","definition":"CHECK (rarity IS NULL OR (rarity IN ('common'::text, 'uncommon'::text, 'rare'::text, 'specialty'::text)))"},
      {"name":"p2_definition_quality_ck","type":"c","definition":"CHECK (quality_mode IS NULL OR (quality_mode IN ('none'::text, 'fixed'::text, 'inherited'::text, 'bounded'::text)))"},
      {"name":"p2_definition_conservation_ck","type":"c","definition":"CHECK (conservation_class IS NULL OR (conservation_class IN ('renewable'::text, 'finite'::text, 'durable'::text, 'consumable'::text)))"},
      {"name":"p2_definition_trade_ck","type":"c","definition":"CHECK (trade_mode IS NULL AND transferable IS NULL AND trade_policy_hash IS NULL OR trade_mode IS NOT NULL AND transferable IS NOT NULL AND trade_policy_hash IS NOT NULL AND (trade_mode IN ('closed'::text, 'ordinary'::text, 'restricted'::text)) AND trade_policy_hash = definition_hash)"},
      {"name":"p2_definition_scopes_ck","type":"c","definition":"CHECK (owner_scopes_json IS NULL OR (owner_scopes_json IN ('[]'::text, '[\"account\"]'::text, '[\"character\"]'::text, '[\"organization\"]'::text, '[\"project\"]'::text, '[\"account\",\"character\"]'::text, '[\"account\",\"organization\"]'::text, '[\"account\",\"project\"]'::text, '[\"character\",\"organization\"]'::text, '[\"character\",\"project\"]'::text, '[\"organization\",\"project\"]'::text, '[\"account\",\"character\",\"organization\"]'::text, '[\"account\",\"character\",\"project\"]'::text, '[\"account\",\"organization\",\"project\"]'::text, '[\"character\",\"organization\",\"project\"]'::text, '[\"account\",\"character\",\"organization\",\"project\"]'::text)))"},
      {"name":"p2_definition_quantity_ck","type":"c","definition":"CHECK (maximum_lot_quantity IS NULL OR maximum_lot_quantity >= 1 AND maximum_lot_quantity <= 1000000)"},
      {"name":"p2_definition_required_ck","type":"c","definition":"CHECK (definition_kind = 'concept'::text OR family IS NOT NULL AND tags_json IS NOT NULL AND rarity IS NOT NULL AND stackable IS NOT NULL AND trade_mode IS NOT NULL AND transferable IS NOT NULL AND trade_policy_hash IS NOT NULL AND owner_scopes_json IS NOT NULL AND quality_mode IS NOT NULL AND maximum_lot_quantity IS NOT NULL AND conservation_class IS NOT NULL)"},
      {"name":"p2_definition_canonical_definition_bytes_ck","type":"c","definition":"CHECK (octet_length(canonical_definition_bytes) >= 1 AND octet_length(canonical_definition_bytes) <= 67108864)"},
      {"name":"p2_definition_trade_policy_hash_ck","type":"c","definition":"CHECK (trade_policy_hash IS NULL OR char_length(trade_policy_hash) = 64 AND trade_policy_hash = lower(trade_policy_hash) AND translate(trade_policy_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
    ],
  },
  {
    table: 'content_bundle_item_definitions',
    columns: [
      ["bundle_hash","text",true,null],
      ["logical_item_id","text",true,null],
      ["definition_hash","text",true,null],
      ["ordinal","integer",true,null],
    ],
    constraints: [
      {"name":"p2_membership_pk","type":"p","definition":"PRIMARY KEY (bundle_hash, logical_item_id)"},
      {"name":"p2_membership_bundle_hash_uq","type":"u","definition":"UNIQUE (bundle_hash, definition_hash)"},
      {"name":"p2_membership_exact_uq","type":"u","definition":"UNIQUE (bundle_hash, logical_item_id, definition_hash)"},
      {"name":"p2_membership_ordinal_uq","type":"u","definition":"UNIQUE (bundle_hash, ordinal)"},
      {"name":"p2_membership_artifact_fk","type":"f","definition":"FOREIGN KEY (bundle_hash) REFERENCES content_bundle_artifacts(bundle_hash)"},
      {"name":"p2_membership_definition_fk","type":"f","definition":"FOREIGN KEY (logical_item_id, definition_hash) REFERENCES item_definition_versions(logical_item_id, definition_hash)"},
      {"name":"p2_membership_bundle_hash_ck","type":"c","definition":"CHECK (char_length(bundle_hash) = 64 AND bundle_hash = lower(bundle_hash) AND translate(bundle_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_membership_definition_hash_ck","type":"c","definition":"CHECK (char_length(definition_hash) = 64 AND definition_hash = lower(definition_hash) AND translate(definition_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_membership_ordinal_ck","type":"c","definition":"CHECK (ordinal >= 0)"},
    ],
  },
  {
    table: 'content_activation_events',
    columns: [
      ["id","bigint",true,"sequence"],
      ["namespace","text",true,null],
      ["activation_revision","bigint",true,null],
      ["previous_bundle_hash","text",false,null],
      ["previous_dependency_lock_hash","text",false,null],
      ["bundle_hash","text",true,null],
      ["dependency_lock_hash","text",true,null],
      ["bundle_version","bigint",true,null],
      ["compiler_version","text",true,null],
      ["ir_version","integer",true,null],
      ["profile","text",true,null],
      ["policy_snapshot_json","text",true,null],
      ["report_hashes_json","text",true,null],
      ["operator_id","text",true,null],
      ["activated_at","timestamp with time zone",true,"now()"],
    ],
    constraints: [
      {"name":"p2_event_pk","type":"p","definition":"PRIMARY KEY (id)"},
      {"name":"p2_event_revision_uq","type":"u","definition":"UNIQUE (namespace, activation_revision)"},
      {"name":"p2_event_exact_uq","type":"u","definition":"UNIQUE (id, namespace, bundle_hash, activation_revision)"},
      {"name":"p2_event_artifact_fk","type":"f","definition":"FOREIGN KEY (namespace, bundle_hash, dependency_lock_hash) REFERENCES content_bundle_artifacts(namespace, bundle_hash, dependency_lock_hash)"},
      {"name":"p2_event_previous_artifact_fk","type":"f","definition":"FOREIGN KEY (namespace, previous_bundle_hash, previous_dependency_lock_hash) REFERENCES content_bundle_artifacts(namespace, bundle_hash, dependency_lock_hash)"},
      {"name":"p2_event_bundle_hash_ck","type":"c","definition":"CHECK (char_length(bundle_hash) = 64 AND bundle_hash = lower(bundle_hash) AND translate(bundle_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_event_dependency_lock_hash_ck","type":"c","definition":"CHECK (char_length(dependency_lock_hash) = 64 AND dependency_lock_hash = lower(dependency_lock_hash) AND translate(dependency_lock_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_event_previous_bundle_hash_ck","type":"c","definition":"CHECK (char_length(previous_bundle_hash) = 64 AND previous_bundle_hash = lower(previous_bundle_hash) AND translate(previous_bundle_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_event_previous_dependency_lock_hash_ck","type":"c","definition":"CHECK (char_length(previous_dependency_lock_hash) = 64 AND previous_dependency_lock_hash = lower(previous_dependency_lock_hash) AND translate(previous_dependency_lock_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_event_activation_revision_ck","type":"c","definition":"CHECK (activation_revision >= 1 AND activation_revision <= '9007199254740991'::bigint)"},
      {"name":"p2_event_bundle_version_ck","type":"c","definition":"CHECK (bundle_version >= 1 AND bundle_version <= '9007199254740991'::bigint)"},
      {"name":"p2_event_namespace_ck","type":"c","definition":"CHECK (char_length(namespace) >= 1 AND char_length(namespace) <= 128)"},
      {"name":"p2_event_compiler_version_ck","type":"c","definition":"CHECK (char_length(compiler_version) >= 1 AND char_length(compiler_version) <= 64)"},
      {"name":"p2_event_operator_id_ck","type":"c","definition":"CHECK (char_length(operator_id) >= 1 AND char_length(operator_id) <= 200)"},
      {"name":"p2_event_ir_version_ck","type":"c","definition":"CHECK (ir_version = 1)"},
      {"name":"p2_event_profile_ck","type":"c","definition":"CHECK (profile = 'phase2_economy'::text)"},
      {"name":"p2_event_previous_ck","type":"c","definition":"CHECK (activation_revision = 1 AND previous_bundle_hash IS NULL AND previous_dependency_lock_hash IS NULL OR activation_revision > 1 AND previous_bundle_hash IS NOT NULL AND previous_dependency_lock_hash IS NOT NULL)"},
    ],
  },
  {
    table: 'content_bundle_activations',
    columns: [
      ["namespace","text",true,null],
      ["bundle_hash","text",false,null],
      ["last_event_id","bigint",false,null],
      ["activated_by","text",false,null],
      ["activated_at","timestamp with time zone",false,null],
      ["activation_revision","bigint",true,"0"],
    ],
    constraints: [
      {"name":"p2_pointer_pk","type":"p","definition":"PRIMARY KEY (namespace)"},
      {"name":"p2_pointer_artifact_fk","type":"f","definition":"FOREIGN KEY (namespace, bundle_hash) REFERENCES content_bundle_artifacts(namespace, bundle_hash)"},
      {"name":"p2_pointer_event_fk","type":"f","definition":"FOREIGN KEY (last_event_id, namespace, bundle_hash, activation_revision) REFERENCES content_activation_events(id, namespace, bundle_hash, activation_revision)"},
      {"name":"p2_pointer_bundle_hash_ck","type":"c","definition":"CHECK (char_length(bundle_hash) = 64 AND bundle_hash = lower(bundle_hash) AND translate(bundle_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_pointer_activation_revision_ck","type":"c","definition":"CHECK (activation_revision >= 0 AND activation_revision <= '9007199254740991'::bigint)"},
      {"name":"p2_pointer_namespace_ck","type":"c","definition":"CHECK (char_length(namespace) >= 1 AND char_length(namespace) <= 128)"},
      {"name":"p2_pointer_state_ck","type":"c","definition":"CHECK (activation_revision = 0 AND bundle_hash IS NULL AND last_event_id IS NULL AND activated_by IS NULL AND activated_at IS NULL OR activation_revision > 0 AND bundle_hash IS NOT NULL AND last_event_id IS NOT NULL AND activated_by IS NOT NULL AND activated_at IS NOT NULL)"},
    ],
  },
  {
    table: 'item_definition_activations',
    columns: [
      ["logical_item_id","text",true,null],
      ["definition_hash","text",true,null],
      ["package_id","text",true,null],
      ["bundle_hash","text",true,null],
      ["activation_revision","bigint",true,null],
      ["event_id","bigint",true,null],
    ],
    constraints: [
      {"name":"p2_selection_pk","type":"p","definition":"PRIMARY KEY (logical_item_id)"},
      {"name":"p2_selection_membership_fk","type":"f","definition":"FOREIGN KEY (bundle_hash, logical_item_id, definition_hash) REFERENCES content_bundle_item_definitions(bundle_hash, logical_item_id, definition_hash)"},
      {"name":"p2_selection_event_fk","type":"f","definition":"FOREIGN KEY (event_id, package_id, bundle_hash, activation_revision) REFERENCES content_activation_events(id, namespace, bundle_hash, activation_revision)"},
      {"name":"p2_selection_definition_hash_ck","type":"c","definition":"CHECK (char_length(definition_hash) = 64 AND definition_hash = lower(definition_hash) AND translate(definition_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_selection_bundle_hash_ck","type":"c","definition":"CHECK (char_length(bundle_hash) = 64 AND bundle_hash = lower(bundle_hash) AND translate(bundle_hash, '0123456789abcdef'::text, ''::text) = ''::text)"},
      {"name":"p2_selection_activation_revision_ck","type":"c","definition":"CHECK (activation_revision >= 1 AND activation_revision <= '9007199254740991'::bigint)"},
    ],
  },
];

export async function verifyPhase2DefinitionSchema(q, { compatibility } = {}) {
  if (compatibility === 'pg-mem') return; // Direct clean-schema tests, never catalog parity.
  const invalid = () => {
    const error = new Error('Phase 2 definition registry schema does not match its reviewed contract.');
    error.code = 'content_registry_schema_invalid';
    throw error;
  };
  if (compatibility !== 'postgres') invalid();
  const names = PHASE2_SCHEMA_CONTRACT.map((spec) => spec.table);
  const columns = (await q.query(
    `SELECT c.relname::text AS table_name,c.relkind::text AS kind,a.attname::text AS name,
      format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required,
      a.attidentity::text AS identity,a.attgenerated::text AS generated,
      pg_get_expr(d.adbin,d.adrelid) AS default_value
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname=current_schema() AND c.relname IN ($1,$2,$3,$4,$5,$6) ORDER BY c.relname,a.attnum`, names,
  )).rows;
  const constraints = (await q.query(
    `SELECT t.relname::text AS table_name,c.conname::text AS name,c.contype::text AS type,
      c.convalidated AS validated,c.condeferrable AS deferrable,
      pg_get_constraintdef(c.oid,true) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname=current_schema() AND t.relname IN ($1,$2,$3,$4,$5,$6)`, names,
  )).rows;
  const indexes = (await q.query(
    `SELECT t.relname::text AS table_name,c.relname::text AS name,i.indisunique AS unique_index,
      i.indisprimary AS primary_index,i.indisvalid AS valid,i.indisready AS ready,
      pg_get_expr(i.indpred,i.indrelid) AS predicate,pg_get_expr(i.indexprs,i.indrelid) AS expressions,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(num,ord)
        JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord) AS columns
      FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_class c ON c.oid=i.indexrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname=current_schema() AND t.relname IN ($1,$2,$3,$4,$5,$6)`, names,
  )).rows;
  for (const spec of PHASE2_SCHEMA_CONTRACT) {
    const actual = columns.filter((row) => row.table_name === spec.table);
    if (actual.length !== spec.columns.length) invalid();
    spec.columns.forEach(([name, type, required, defaultValue], index) => {
      const row = actual[index];
      if (row.kind !== 'r' || row.name !== name || row.type !== type || row.required !== required
          || row.identity !== '' || row.generated !== '') invalid();
      if (defaultValue === 'sequence') {
        if (!/^nextval\('[^']+'::regclass\)$/.test(row.default_value ?? '')) invalid();
      } else if (row.default_value !== defaultValue) invalid();
    });
    for (const expected of spec.constraints) {
      const row = constraints.find((value) => value.table_name === spec.table && value.name === expected.name);
      if (!row || row.type !== expected.type || !row.validated || row.deferrable
          || phase2CatalogDefinition(row.definition) !== expected.definition) invalid();
      if (expected.type === 'p' || expected.type === 'u') {
        const index = indexes.find((value) => value.table_name === spec.table && value.name === expected.name);
        const key = expected.definition.match(/\(([^)]+)\)/)[1].split(', ');
        if (!index || !index.unique_index || index.primary_index !== (expected.type === 'p')
            || !index.valid || !index.ready || index.predicate || index.expressions
            || !exactStringArray(index.columns, key)) invalid();
      }
    }
  }
  const selection = indexes.find((row) => row.name === 'p2_selection_package_idx'
    && row.table_name === 'item_definition_activations');
  if (!selection || selection.unique_index || selection.primary_index || !selection.valid || !selection.ready
      || selection.predicate || selection.expressions
      || !exactStringArray(selection.columns, ['package_id', 'logical_item_id'])) invalid();
}

function phase2CatalogDefinition(definition) {
  // PostgreSQL deparses literal IN lists as scalar-array equalities. Render only this exact,
  // literal-text form as IN for the readable contract; keep every cast, literal and grouping.
  return definition.replace(/= ANY \(ARRAY\[((?:'(?:[^']|'')*'::text(?:, )?)+)\]\)/g, 'IN ($1)');
}

export async function makeDb() {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import('pg');
    // (red-team R10 F1) node-pg defaults to max=10 connections. Every withCharacter-backed request
    // (incl. read GETs, which accrue+persist under `SELECT … FOR UPDATE` on the caller's own row) holds
    // a pooled connection while it runs — so a burst of concurrent requests from one account can pin the
    // whole pool and starve every other account. Raise the headroom (env-tunable); paired with the
    // per-account read throttle in the server preHandler, this bounds the connection-flood.
    // NOTHING MAY WAIT FOREVER. Without these, one pathological query or one leaked transaction
    // holds a pooled connection — and a character row lock — until someone notices, which for a
    // player means their character is simply frozen. Postgres enforces all three server-side, so
    // they hold even if the Node process stops paying attention.
    //
    //   statement_timeout                     no single query outlives this
    //   lock_timeout                          a request waiting on a locked row gives up and says so,
    //                                         rather than queueing behind it indefinitely. Surfaces as
    //                                         55P03, which maps to the retryable `contention` error.
    //   idle_in_transaction_session_timeout   a transaction left open by a crashed handler is killed
    //                                         instead of holding its row locks until the pool recycles
    const timeouts = [
      `statement_timeout=${Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000)}`,
      `lock_timeout=${Number(process.env.PG_LOCK_TIMEOUT_MS || 8000)}`,
      `idle_in_transaction_session_timeout=${Number(process.env.PG_IDLE_TX_TIMEOUT_MS || 30000)}`,
    ].join(' -c ');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 20),
      // fail fast when the pool is exhausted: a request that cannot get a connection in 10s should
      // return a clean 503 rather than pile onto a queue that is already the problem
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      options: `-c ${timeouts}`,
    });
    // THE PROCESS MUST SURVIVE THE DATABASE RESTARTING. node-pg emits 'error' on the Pool when an IDLE
    // pooled connection dies — a Postgres restart, a failover, an idle-timeout reaper, a network blip.
    // An EventEmitter with no 'error' listener THROWS, and an uncaught exception kills Node. So without
    // this handler the entire API (and the worker) crashes every single time the database bounces.
    //
    // Found by stopping a real Postgres under a running server: the process did not degrade, it died
    // with `Unhandled 'error' event: terminating connection due to administrator command`. That is very
    // likely what a tester actually hit as "Internal error on every crime" — not a bug in the crime
    // path at all, but the server being restarted underneath them.
    //
    // The correct response is to log and carry on. A dead idle connection is not a dead pool: node-pg
    // discards it and opens a fresh one on the next checkout, so the very next request recovers by
    // itself. Errors on a connection that a request is actively holding still reject that request's
    // promise and surface through the normal error path (503 db_down) — this handler only catches the
    // idle-connection case, which has no request to reject.
    pool.on('error', (err) => {
      console.error('[db] idle client error (pool recovers on next checkout):', err.message);
    });
    // …AND THE OTHER HALF OF THE SAME CLASS, which the handler above does NOT cover and which the
    // comment above was right to say so. `pool.on('error')` fires for clients sitting IDLE in the pool.
    // A client that a request has CHECKED OUT (`pool.connect()`, ~73 sites, every transaction in the
    // game) emits 'error' on ITSELF when its connection dies mid-transaction — and an EventEmitter with
    // no listener THROWS, so the process dies exactly as it did before the idle handler existed.
    //
    // Found by `tools/chaos.js`: terminating backends mid-transaction under load killed the API with
    // `Unhandled 'error' event: Connection terminated unexpectedly`. Same symptom as the 2026-07-25
    // outage, different code path — the earlier fix closed half the door.
    //
    // This is not exotic. It fires on any Postgres restart or failover that lands while a transaction
    // is open, on a network blip, on an admin `pg_terminate_backend` — and, pointedly, on our OWN
    // `idle_in_transaction_session_timeout` (30s, set below), which exists to stop a leaked transaction
    // holding row locks forever. That safety valve terminates the backend, so before this handler it
    // could take the whole server down with it.
    //
    // Logging is the entire correct response. node-pg already rejects the in-flight query's promise, so
    // the request still fails through the normal path and answers 503 db_down; the client is discarded
    // rather than returned to the pool. All this prevents is the unhandled throw. Attached ONCE per
    // client (a pooled client is checked out many times — re-attaching would leak listeners until
    // Node's MaxListeners warning fires).
    //
    // WHY THIS WRAPS `connect` AND NOT `query` — verified against pg-pool, not assumed, because the
    // obvious "simplification" is wrong in a way that only shows up during an outage. `pool.query()`
    // attaches its OWN `client.once('error', …)` for the life of the call, so a one-off query is
    // already covered and needs nothing from us. The exposed path is the one this game runs on: every
    // transaction does `pool.connect()` and holds the client across many awaits, and checkout REMOVES
    // the idle-time error listener the pool installed. Between checkout and release there is no
    // listener at all — which is precisely the window a transaction lives in. Removing this wrapper on
    // the grounds that "pg handles client errors" reopens exactly that window; `tools/chaos.js`
    // scenario 2 kills backends mid-transaction and the process dies without it.
    const HANDLED = Symbol.for('omerta.clientErrorHandled');
    const rawConnect = pool.connect.bind(pool);
    pool.connect = async (...args) => {
      const client = await rawConnect(...args);
      if (client && !client[HANDLED]) {
        client[HANDLED] = true;
        client.on('error', (err) => {
          console.error('[db] in-flight client error (this request fails; the process survives):', err.message);
        });
      }
      return client;
    };
    // (deploy R31) SERIALIZE first-boot schema creation ACROSS PROCESSES. In a multi-process deploy (the API
    // + the worker), both boot at the same instant against a FRESH DB and BOTH run `CREATE TABLE IF NOT
    // EXISTS` concurrently — Postgres races on its internal type catalog and one process crashes with
    // `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`. `CREATE TABLE IF NOT
    // EXISTS` is NOT concurrency-safe. A session advisory lock makes the second booter wait, then apply the
    // (now already-created) schema where every CREATE/ADD IF NOT EXISTS cleanly no-ops. One dedicated
    // connection holds the lock across the DDL, then releases it; pg-mem (single process) needs none of this.
    const boot = await pool.connect();
    try {
      await boot.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY]);
      const { migration: mig } = await migrateSchemaUnderLock(boot);
      console.log(`[db] Postgres ready — column migration ran ${mig.total} ADD COLUMN IF NOT EXISTS statements${mig.failed ? ` (${mig.failed} skipped — see above)` : ''}.`);
    } finally {
      await boot.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]).catch(() => {});
      boot.release();
    }
    dbCaps.skipLocked = true; // real Postgres — see dbCaps
    dbCaps.indexedTextArrayAny = true; // pg-mem returns zero for indexed TEXT = ANY(array), even with scalar literals
    return pool;
  }
  // (red-team R9 config F2) A production deploy that forgot DATABASE_URL would SILENTLY boot the whole
  // game on an in-memory pg-mem DB — every account/dollar/$OMR/voucher lives only in RAM, lost on restart,
  // with subtly different SQL semantics. Refuse rather than fail open (the JWT/MARKET_SEED posture).
  if (process.env.NODE_ENV === 'production')
    throw new Error('DATABASE_URL must be set in production — refusing to boot on the in-memory pg-mem database (all state would be lost on restart).');
  dbCaps.skipLocked = false; // pg-mem parses neither SKIP LOCKED nor NOWAIT
  const { newDb, DataType } = await import('pg-mem');
  dbCaps.indexedTextArrayAny = false;
  const mem = newDb();
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  await stampSchema(pool); // same stamp as the real-PG path, so tests exercise it
  console.log('[db] pg-mem in-memory database (set DATABASE_URL for Postgres)');
  return pool;
}
