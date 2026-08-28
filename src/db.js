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
export const dbCaps = { skipLocked: false };

// Register only the PostgreSQL built-ins that H1's literal schema needs and pg-mem omits. Callers
// that create a raw pg-mem database for schema tests must opt in before applying schema.sql; the
// real-Postgres branch never calls this compatibility registrar.
export function registerPgMemCompatibility(mem, DataType) {
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

// Called only while makeDb holds the existing session advisory lock. Keeping the sequence in one
// tested seam prevents a future boot edit from stamping a build before its fail-closed authority
// migration completed.
export async function migrateSchemaUnderLock(
  boot, { schemaText = SCHEMA, compatibility = 'postgres' } = {},
) {
  await boot.query(schemaText);
  const migration = await migrateColumns(boot, schemaText);
  await migrateTask5BallotV2(boot, { compatibility });
  const stamp = await stampSchema(boot);
  return { migration, stamp };
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
    return pool;
  }
  // (red-team R9 config F2) A production deploy that forgot DATABASE_URL would SILENTLY boot the whole
  // game on an in-memory pg-mem DB — every account/dollar/$OMR/voucher lives only in RAM, lost on restart,
  // with subtly different SQL semantics. Refuse rather than fail open (the JWT/MARKET_SEED posture).
  if (process.env.NODE_ENV === 'production')
    throw new Error('DATABASE_URL must be set in production — refusing to boot on the in-memory pg-mem database (all state would be lost on restart).');
  dbCaps.skipLocked = false; // pg-mem parses neither SKIP LOCKED nor NOWAIT
  const { newDb, DataType } = await import('pg-mem');
  const mem = newDb();
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  await stampSchema(pool); // same stamp as the real-PG path, so tests exercise it
  console.log('[db] pg-mem in-memory database (set DATABASE_URL for Postgres)');
  return pool;
}
