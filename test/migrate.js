// THE COLUMN-MIGRATION test (the 34th suite) — the in-place-upgrade fix (red-team R30 MED-1).
// schema.sql is 100% `CREATE TABLE IF NOT EXISTS`, so on an ALREADY-created Postgres DB a column added to a
// table's CREATE block after the table first existed is silently absent — an in-place upgrade then 500s on
// every path naming a new column. `columnMigrations(schema)` derives an idempotent `ALTER TABLE … ADD COLUMN
// IF NOT EXISTS` set FROM the schema text (drift-proof + auto-covers future columns); `migrateColumns` runs
// it. This proves: the derived set is well-formed (no constraint/multi-column leakage), it's a clean no-op on
// a fresh DB, and — the actual fix — it RE-ADDS a column an "old" DB is missing. pg-mem, zero infra.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataType, newDb } from 'pg-mem';
import { columnMigrations, migrateColumns, registerPgMemCompatibility } from '../src/db.js';
import * as dbModule from '../src/db.js';
import { srcText, walkSrc } from './lib/srcfiles.js';

const SCHEMA = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql'), 'utf8');

const LEGACY_TASK5_SCHEMA = `
CREATE TABLE ticker_ballot_days_v2 (
  day INT PRIMARY KEY CHECK (day >= 0),
  state TEXT NOT NULL CHECK (state IN
    ('open','closed_ready','skipped_catalog_unavailable','skipped_catalog_empty',
     'skipped_no_valid_candidate')),
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT NOT NULL,
  catalog_version NUMERIC(78,0) NOT NULL CHECK (catalog_version >= 0),
  catalog_snapshot_hash TEXT NOT NULL,
  max_eth_wei NUMERIC(78,0) NOT NULL CHECK (max_eth_wei > 0),
  opened_by TEXT NOT NULL,
  open_details_hash TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  purchase_until TIMESTAMPTZ,
  CHECK (closes_at > opened_at),
  CHECK ((state = 'closed_ready') = (purchase_until IS NOT NULL)),
  CHECK (purchase_until IS NULL OR purchase_until = closes_at + interval '7200 seconds')
);
CREATE TABLE ticker_ballot_candidates_v2 (
  day INT NOT NULL,
  asset_version_key TEXT NOT NULL,
  ticker TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_decimals INT NOT NULL CHECK (token_decimals >= 0 AND token_decimals <= 255),
  registry_index NUMERIC(78,0) NOT NULL CHECK (registry_index >= 0),
  PRIMARY KEY (day, asset_version_key)
);
CREATE TABLE commission_ticker_votes_v2 (
  day INT NOT NULL,
  family_id TEXT NOT NULL,
  asset_version_key TEXT NOT NULL,
  ticker TEXT NOT NULL,
  standing NUMERIC(78,0) NOT NULL CHECK (standing >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, family_id)
);
CREATE TABLE ticker_ballot_results_v2 (
  day INT PRIMARY KEY CHECK (day >= 0),
  status TEXT NOT NULL CHECK (status IN
    ('closed_ready','skipped_catalog_unavailable','skipped_catalog_empty',
     'skipped_no_valid_candidate')),
  asset_version_key TEXT,
  ticker TEXT,
  token_address TEXT,
  token_decimals INT CHECK (token_decimals >= 0 AND token_decimals <= 255),
  registry_index NUMERIC(78,0),
  catalog_version NUMERIC(78,0) NOT NULL CHECK (catalog_version >= 0),
  catalog_snapshot_hash TEXT NOT NULL,
  max_eth_wei NUMERIC(78,0) NOT NULL CHECK (max_eth_wei > 0),
  votes INT NOT NULL DEFAULT 0 CHECK (votes >= 0 AND votes <= 5),
  weighted INT NOT NULL DEFAULT 0 CHECK (weighted >= 0 AND weighted <= 15),
  decided_by TEXT NOT NULL CHECK (decided_by IN
    ('chamber','default_silence','default_tie','skipped')),
  decided_by_code INT NOT NULL CHECK (decided_by_code >= 1 AND decided_by_code <= 6),
  skip_reason TEXT,
  tally_hash TEXT NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  purchase_until TIMESTAMPTZ,
  publication_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (publication_status IN
    ('not_submitted','publisher_submitted','published_pending_finality','finalized','reorged','failed')),
  registry_tx_hash TEXT,
  finalized_block_number NUMERIC(78,0),
  finalized_block_hash TEXT,
  finalized_at TIMESTAMPTZ,
  CHECK ((status = 'closed_ready') = (asset_version_key IS NOT NULL)),
  CHECK ((status = 'closed_ready') = (ticker IS NOT NULL)),
  CHECK ((status = 'closed_ready') = (token_address IS NOT NULL)),
  CHECK ((status = 'closed_ready') = (token_decimals IS NOT NULL)),
  CHECK ((status = 'closed_ready') = (registry_index IS NOT NULL)),
  CHECK ((status = 'closed_ready') = (purchase_until IS NOT NULL)),
  CHECK ((status = 'closed_ready') = (skip_reason IS NULL)),
  CHECK (publication_status = 'not_submitted' OR status = 'closed_ready')
);`;

// A populated database with exactly the original four Task 5 tables is the migration authority.
// It must not gain invented activation or closed-vote evidence merely because a new binary booted.
{
  const legacy = newDb();
  registerPgMemCompatibility(legacy, DataType);
  const { Pool: LegacyPool } = legacy.adapters.createPg();
  const legacyPool = new LegacyPool();
  await legacyPool.query(LEGACY_TASK5_SCHEMA);
  const key = `0x${'1'.repeat(64)}`;
  const address = `0x${'1'.repeat(40)}`;
  const snapshot = `0x${'c'.repeat(64)}`;
  const tally = `0x${'f'.repeat(64)}`;
  await legacyPool.query(
    `INSERT INTO ticker_ballot_days_v2
      (day,state,chain_id,registry_address,catalog_version,catalog_snapshot_hash,max_eth_wei,
       opened_by,open_details_hash,opened_at,closes_at,closed_at,purchase_until)
     VALUES (20700,'closed_ready',4663,$1,'1',$2,'1','legacy',$3,$4,$5,$5,$6)`,
    [address, snapshot, snapshot, '2026-09-04T00:00:00Z', '2026-09-05T00:00:00Z',
      '2026-09-05T02:00:00Z'],
  );
  await legacyPool.query(
    `INSERT INTO ticker_ballot_candidates_v2
      (day,asset_version_key,ticker,token_address,token_decimals,registry_index)
     VALUES (20700,$1,'T1',$2,18,'0')`, [key, address],
  );
  await legacyPool.query(
    `INSERT INTO commission_ticker_votes_v2
      (day,family_id,asset_version_key,ticker,standing) VALUES (20700,'family-old',$1,'T1','500')`,
    [key],
  );
  await legacyPool.query(
    `INSERT INTO ticker_ballot_results_v2
      (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
       catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
       decided_by_code,skip_reason,tally_hash,closed_at,purchase_until,publication_status)
     VALUES (20700,'closed_ready',$1,'T1',$2,18,'0','1',$3,'1',1,5,'chamber',1,NULL,$4,
       '2026-09-05T00:00:00Z','2026-09-05T02:00:00Z','not_submitted')`,
    [key, address, snapshot, tally],
  );
  assert.equal(typeof dbModule.migrateTask5BallotV2, 'function',
    'boot exposes the targeted fail-closed Task 5 authority migration');
  await dbModule.migrateTask5BallotV2(legacyPool, { compatibility: 'pg-mem' });
  const migratedCandidate = (await legacyPool.query(
    'SELECT activation_evidence_version,activated_at FROM ticker_ballot_candidates_v2',
  )).rows[0];
  assert.equal(Number(migratedCandidate.activation_evidence_version), 0);
  assert.equal(migratedCandidate.activated_at, null,
    'a legacy candidate remains version-zero with no invented opening activation');
  const migratedVote = (await legacyPool.query(
    `SELECT closed_valid,closed_counted,closed_weight,closed_exclusion_reason
       FROM commission_ticker_votes_v2`,
  )).rows[0];
  assert.deepEqual(migratedVote, {
    closed_valid: null, closed_counted: null, closed_weight: null, closed_exclusion_reason: null,
  });
  const migratedResult = (await legacyPool.query(
    'SELECT vote_evidence_version FROM ticker_ballot_results_v2',
  )).rows[0];
  assert.equal(Number(migratedResult.vote_evidence_version), 0,
    'already-closed legacy results remain explicitly unproven');
  assert.equal((await legacyPool.query(
    'SELECT count(*)::int AS n FROM ticker_ballot_candidates_v2',
  )).rows[0].n, 1, 'migration preserves populated legacy rows');
  await assert.rejects(legacyPool.query(
    `INSERT INTO ticker_ballot_days_v2
      (day,state,chain_id,registry_address,catalog_version,catalog_snapshot_hash,max_eth_wei,
       opened_by,open_details_hash,opened_at,closes_at)
     VALUES (100000000,'open',4663,$1,'1',$2,'1','bad',$3,$4,$5)`,
    [address, snapshot, snapshot, '2026-09-04T00:00:00Z', '2026-09-05T00:00:00Z'],
  ), undefined, 'migrated day constraint rejects the first unrepresentable day');
  await assert.rejects(legacyPool.query(
    `INSERT INTO ticker_ballot_candidates_v2
      (day,asset_version_key,ticker,token_address,token_decimals,registry_index,
       activation_evidence_version,activated_at)
     VALUES (20700,$1,'BAD',$2,18,'1',1,NULL)`,
    [`0x${'2'.repeat(64)}`, `0x${'2'.repeat(40)}`],
  ), undefined, 'current candidate evidence cannot omit its frozen activation');
  await assert.rejects(legacyPool.query(
    `UPDATE commission_ticker_votes_v2
        SET closed_valid=true,closed_counted=true,closed_weight=0
      WHERE day=20700 AND family_id='family-old'`,
  ), undefined, 'migrated frozen tuple constraint rejects an incoherent counted weight');
  await assert.rejects(legacyPool.query(
    `UPDATE ticker_ballot_results_v2
        SET publication_status='not_submitted',registry_tx_hash=$1
      WHERE day=20700`, [tally],
  ), undefined, 'migrated result publication tuple rejects false not-submitted evidence');

  // The populated migration receives the same complete publication/finality state machine as a
  // fresh table. Task 6 does not perform these transitions yet; this is storage-shape authority only.
  let publicationDay = 20800;
  const migratedPublication = (publicationStatus, fields = {}, status = 'closed_ready') => {
    const ready = status === 'closed_ready';
    return legacyPool.query(
      `INSERT INTO ticker_ballot_results_v2
        (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
         catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
         decided_by_code,skip_reason,tally_hash,closed_at,purchase_until,publication_status,
         registry_tx_hash,finalized_block_number,finalized_block_hash,finalized_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'1',$8,'1',$9,$10,$11,$12,$13,$14,$15,$16,$17,
         $18,$19,$20,$21)`,
      [publicationDay++, status, ready ? key : null, ready ? 'T1' : null,
        ready ? address : null, ready ? 18 : null, ready ? '0' : null, snapshot,
        ready ? 1 : 0, ready ? 5 : 0, ready ? 'chamber' : 'skipped', ready ? 1 : 6,
        ready ? null : 'no_valid_candidate', tally, '2026-09-05T00:00:00Z',
        ready ? '2026-09-05T02:00:00Z' : null, publicationStatus, fields.tx ?? null,
        fields.number ?? null, fields.blockHash ?? null, fields.at ?? null],
    );
  };
  const blockHash = `0x${'b'.repeat(64)}`;
  for (const [state, fields] of [
    ['not_submitted', {}],
    ['publisher_submitted', { tx: tally }],
    ['published_pending_finality', { tx: tally }],
    ['finalized', { tx: tally, number: '7', blockHash, at: '2026-09-05T00:00:01Z' }],
    ['reorged', { tx: tally }],
    ['failed', {}],
    ['failed', { tx: tally }],
  ]) await migratedPublication(state, fields);
  await migratedPublication('not_submitted', {}, 'skipped_no_valid_candidate');
  for (const [state, fields] of [
    ['not_submitted', { tx: tally }],
    ['publisher_submitted', {}],
    ['publisher_submitted', { tx: `0x${'A'.repeat(64)}` }],
    ['publisher_submitted', { tx: `0x${'z'.repeat(64)}` }],
    ['publisher_submitted', { tx: `0x${'a'.repeat(63)}` }],
    ['publisher_submitted', { tx: tally, number: '7' }],
    ['published_pending_finality', { tx: tally, blockHash }],
    ['finalized', { tx: tally, number: '7', blockHash }],
    ['finalized', { tx: tally, number: '7', blockHash: 'not-a-hash', at: '2026-09-05T00:00:01Z' }],
    ['finalized', { tx: tally, number: '7', blockHash: `0x${'B'.repeat(64)}`,
      at: '2026-09-05T00:00:01Z' }],
    ['reorged', {}],
    ['reorged', { tx: tally, at: '2026-09-05T00:00:01Z' }],
    ['failed', { tx: tally, number: '7' }],
  ]) await assert.rejects(migratedPublication(state, fields), undefined,
    `migrated ${state} rejects publication fields ${JSON.stringify(fields)}`);
  await assert.rejects(migratedPublication(
    'not_submitted', { tx: tally }, 'skipped_no_valid_candidate',
  ));
  await assert.rejects(migratedPublication('failed', {}, 'skipped_no_valid_candidate'));
  await dbModule.migrateTask5BallotV2(legacyPool, { compatibility: 'pg-mem' });
  assert.equal((await legacyPool.query(
    'SELECT count(*)::int AS n FROM ticker_ballot_results_v2',
  )).rows[0].n, 9, 'targeted migration is exact-idempotent on a populated schema');
  await legacyPool.end();
}

// Invalid pre-existing authority must abort before adding even the compatibility columns. Real
// PostgreSQL additionally supplies transactional DDL rollback for any later constraint failure.
{
  const invalid = newDb();
  registerPgMemCompatibility(invalid, DataType);
  const { Pool: InvalidPool } = invalid.adapters.createPg();
  const invalidPool = new InvalidPool();
  await invalidPool.query(LEGACY_TASK5_SCHEMA);
  const zero = `0x${'0'.repeat(64)}`;
  await invalidPool.query(
    `INSERT INTO ticker_ballot_days_v2
      (day,state,chain_id,registry_address,catalog_version,catalog_snapshot_hash,max_eth_wei,
       opened_by,open_details_hash,opened_at,closes_at)
     VALUES (100000000,'open',4663,$1,'1',$2,'1','legacy',$3,$4,$5)`,
    [`0x${'1'.repeat(40)}`, zero, zero, '2026-09-04T00:00:00Z', '2026-09-05T00:00:00Z'],
  );
  let failure;
  try { await dbModule.migrateTask5BallotV2(invalidPool, { compatibility: 'pg-mem' }); }
  catch (error) { failure = error; }
  assert(failure, 'invalid legacy authority stops the targeted migration');
  let gainedColumn = true;
  try { await invalidPool.query('SELECT activation_evidence_version FROM ticker_ballot_candidates_v2'); }
  catch { gainedColumn = false; }
  assert.equal(gainedColumn, false, 'invalid legacy data leaves the pre-migration schema untouched');
  await invalidPool.end();
}

// The targeted lane owns one transaction and preserves the exact failing database error. pg-mem
// does not roll transactional DDL back, so this narrow adapter asserts the production BEGIN/ROLLBACK
// boundary while the invalid-data case above proves no compatibility DDL is reached at all.
{
  const injected = Object.assign(new Error('injected production authority-lock failure'), {
    code: '55P03',
  });
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('LOCK TABLE')) throw injected;
      return { rows: [] };
    },
  };
  await assert.rejects(dbModule.migrateTask5BallotV2(client), (error) => error === injected);
  assert.equal(statements[0], 'BEGIN');
  assert(statements[1].includes('task5_ballot_v2_targeted_migration'));
  assert.match(statements[2], /LOCK TABLE ticker_ballot_days_v2,ticker_ballot_candidates_v2,[\s\S]*commission_ticker_votes_v2,ticker_ballot_results_v2[\s\S]*ACCESS EXCLUSIVE/i,
    'production freezes all four authority tables before it validates or alters legacy data');
  assert.equal(statements.at(-1), 'ROLLBACK');
}

{
  const broken = newDb();
  registerPgMemCompatibility(broken, DataType);
  const { Pool: BrokenPool } = broken.adapters.createPg();
  const brokenPool = new BrokenPool();
  await brokenPool.query(LEGACY_TASK5_SCHEMA);
  const injected = Object.assign(new Error('injected Task 5 constraint failure'), { code: 'XXT51' });
  const statements = [];
  const query = brokenPool.query.bind(brokenPool);
  const client = {
    async query(sql, params = []) {
      statements.push(sql);
      if (sql.includes('ADD CONSTRAINT ck_ticker_ballot_days_v2_day_range')) throw injected;
      return query(sql, params);
    },
  };
  await assert.rejects(
    dbModule.migrateTask5BallotV2(client, { compatibility: 'pg-mem' }),
    (error) => error === injected,
  );
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.includes('COMMIT'), false,
    'a targeted authority constraint failure never commits a partial migration');
  await brokenPool.end();
}

// ── 1. the derived statement set is well-formed ──
const stmts = columnMigrations(SCHEMA);
assert(stmts.length > 500, `expected a large ADD COLUMN set from the whole schema, got ${stmts.length}`);
assert(stmts.every((s) => s.startsWith('ALTER TABLE ') && s.includes(' ADD COLUMN IF NOT EXISTS ')), 'every statement is an idempotent ADD COLUMN');
// no table-level constraint line leaked in as a "column"
assert.equal(stmts.filter((s) => /ADD COLUMN IF NOT EXISTS (PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT|INSERT|CREATE|SELECT)\b/i.test(s)).length, 0,
  'no PRIMARY KEY/UNIQUE/FOREIGN/CHECK/CONSTRAINT (or stray statement) is mistaken for a column');
// no statement carries a stray TOP-LEVEL comma (i.e. multiple columns crammed into one ALTER)
const hasTopComma = (s) => { const d = s.replace(/^ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS \w+ /, ''); let dp = 0; for (const c of d) { if (c === '(') dp++; else if (c === ')') dp--; else if (c === ',' && dp === 0) return true; } return false; };
assert.equal(stmts.filter(hasTopComma).length, 0, 'each statement adds exactly ONE column (multi-column lines split on depth-0 commas)');
const task5ActivationColumn = stmts.find((statement) => statement.startsWith(
  'ALTER TABLE ticker_ballot_candidates_v2 ADD COLUMN IF NOT EXISTS activated_at ',
));
assert(task5ActivationColumn && !/\bNOT NULL\b/i.test(task5ActivationColumn),
  'generic migration never attempts a populated NOT NULL/no-default Task 5 activation column');
// known later-added columns are covered (these are exactly the ones an in-place upgrade would miss)
for (const need of [
  'ALTER TABLE track_bets ADD COLUMN IF NOT EXISTS odds NUMERIC',
  'ALTER TABLE track_bets ADD COLUMN IF NOT EXISTS bet_racer_id TEXT',
  'ALTER TABLE characters ADD COLUMN IF NOT EXISTS wire_tier INT NOT NULL DEFAULT 0',
  'ALTER TABLE characters ADD COLUMN IF NOT EXISTS contraband NUMERIC NOT NULL DEFAULT 0',
  'ALTER TABLE characters ADD COLUMN IF NOT EXISTS heat_exposure NUMERIC NOT NULL DEFAULT 0',
  'ALTER TABLE commission_votes ADD COLUMN IF NOT EXISTS standing',
  'ALTER TABLE gang_members ADD COLUMN IF NOT EXISTS joined_at',
]) assert(stmts.some((s) => s.startsWith(need)), `migration must cover: ${need}`);
// column-level PRIMARY KEY is stripped from the generated def (the ADD COLUMN is always safe)
const idStmt = stmts.find((s) => s.startsWith('ALTER TABLE characters ADD COLUMN IF NOT EXISTS id '));
assert(idStmt && !/PRIMARY KEY/i.test(idStmt), 'column-level PRIMARY KEY is stripped from the ADD COLUMN def');

// ── 1b. THE RE-APPLY LEDGER — every statement in schema.sql survives being run twice ──
// schema.sql is applied at EVERY boot (`makeDb` → `boot.query(SCHEMA)`), and node-pg sends the whole
// file as ONE simple query, which Postgres runs as an IMPLICIT TRANSACTION: one error aborts the
// entire batch and `makeDb` throws, so the process refuses to boot. On a fresh database that never
// happens; on an EXISTING one — i.e. every deploy after the first — any non-idempotent statement is a
// crash loop. That is the 2026-08-06 outage (`gang_members.post`) and it recurred on 2026-08-28, when
// five `CREATE INDEX` statements shipped without `IF NOT EXISTS` while the other 155 in the file had
// it. pgcheck §7 catches this behaviourally and did, but it needs a real database and runs in its own
// CI job; this is the same property asserted from the text alone, in `npm test`, on every PR.
//
// THE RULE IS PER-SHAPE, because "idempotent" means something different for each kind of DDL — an
// index and a table say IF NOT EXISTS, a constraint has no such clause and must be DROPped first, a
// seed row needs ON CONFLICT or a WHERE NOT EXISTS guard. Anything the classifier does not recognise
// is a FAILURE, not a pass: a new shape has to be added deliberately with its idempotent form stated,
// which is the whole point of catalogue-or-declare.
{
  // Split on top-level `;`, tracking parens, quotes, dollar-quoting and `--` comments. Hand-rolled
  // rather than a regex for the reason the SQL scanner is: statements here span many lines and carry
  // both quote characters, and a regex reads them wrong in a way that silently drops statements.
  const statements = [];
  {
    let depth = 0, quote = null, dollar = false, cur = '';
    for (let i = 0; i < SCHEMA.length; i++) {
      const c = SCHEMA[i];
      if (dollar) { if (c === '$' && SCHEMA[i + 1] === '$') { dollar = false; cur += '$$'; i++; continue; } cur += c; continue; }
      if (quote) { cur += c; if (c === quote && SCHEMA[i - 1] !== '\\') quote = null; continue; }
      if (c === '$' && SCHEMA[i + 1] === '$') { dollar = true; cur += '$$'; i++; continue; }
      if (c === "'" || c === '"') { quote = c; cur += c; continue; }
      if (c === '-' && SCHEMA[i + 1] === '-') { while (i < SCHEMA.length && SCHEMA[i] !== '\n') i++; cur += '\n'; continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      if (c === ';' && depth === 0) { statements.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) statements.push(cur.trim());
  }

  // Each entry: the shape, and the form that makes THAT shape safe to run a second time.
  const SAFE = [
    [/^CREATE TABLE IF NOT EXISTS\b/i, 'CREATE TABLE … IF NOT EXISTS'],
    [/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS\b/i, 'CREATE INDEX … IF NOT EXISTS'],
    [/^ALTER TABLE [\s\S]*\bADD COLUMN IF NOT EXISTS\b/i, 'ALTER TABLE … ADD COLUMN IF NOT EXISTS'],
    [/^ALTER TABLE [\s\S]*\bDROP CONSTRAINT IF EXISTS\b/i, 'ALTER TABLE … DROP CONSTRAINT IF EXISTS'],
    // A seed row is idempotent either by ON CONFLICT or by the WHERE NOT EXISTS form this file uses.
    [/^INSERT INTO [\s\S]*\bON CONFLICT\b/i, 'INSERT … ON CONFLICT'],
    [/^INSERT INTO [\s\S]*\bWHERE NOT EXISTS\b/i, 'INSERT … WHERE NOT EXISTS'],
    // An UPDATE is idempotent when it sets constants under a predicate that stops matching (or keeps
    // producing the same result). The occupation seeds are the recorded case — see the E1 note in
    // CLAUDE.md about a re-boot re-occupying a district players had liberated.
    [/^UPDATE [\s\S]*\bSET\b[\s\S]*\bWHERE\b/i, 'UPDATE … WHERE (converges)'],
  ];
  // Postgres has NO `ADD CONSTRAINT IF NOT EXISTS`, so the only idempotent way to add one is to DROP
  // it first — which is what this file does. So an ADD CONSTRAINT is safe exactly when a matching
  // `DROP CONSTRAINT IF EXISTS` for the SAME table and name appears EARLIER in the file. Matching on
  // the pair rather than on proximity is what makes it decidable: a drop for a different constraint
  // sitting next to it would look identical to the eye and would not make it safe.
  const dropped = new Set();
  const constraintAdd = /^ALTER TABLE\s+(\w+)[\s\S]*?\bADD CONSTRAINT\s+(\w+)/i;
  const constraintDrop = /^ALTER TABLE\s+(\w+)[\s\S]*?\bDROP CONSTRAINT IF EXISTS\s+(\w+)/i;
  const shapeOf = (statement) => {
    const direct = SAFE.find(([re]) => re.test(statement))?.[1];
    if (direct) return direct;
    const add = statement.match(constraintAdd);
    if (add && dropped.has(`${add[1]}.${add[2]}`)) return 'ALTER TABLE … DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT';
    return null;
  };

  // SELF-TEST FIRST, before the scan, so a matcher that has stopped discriminating fails HERE rather
  // than somewhere downstream that names the wrong thing.
  assert.equal(shapeOf('CREATE UNIQUE INDEX ux_x ON t (a)'), null,
    'a bare CREATE INDEX must never classify safe — it is the exact statement that crashed the boot');
  assert.equal(shapeOf('ALTER TABLE t ADD CONSTRAINT ck_x CHECK (a > 0)'), null,
    'a bare ADD CONSTRAINT must never classify safe — Postgres has no IF NOT EXISTS for it');
  assert.equal(shapeOf('CREATE TABLE t (a INT)'), null, 'a bare CREATE TABLE must never classify safe');
  assert(shapeOf('CREATE UNIQUE INDEX IF NOT EXISTS ux_x ON t (a)'), 'the guarded index form must classify safe');
  dropped.add('t.ck_x');
  assert(shapeOf('ALTER TABLE t ADD CONSTRAINT ck_x CHECK (a > 0)'),
    'an ADD CONSTRAINT paired with an earlier DROP … IF EXISTS for the SAME name must classify safe');
  assert.equal(shapeOf('ALTER TABLE t ADD CONSTRAINT ck_other CHECK (a > 0)'), null,
    'the pair must match on NAME — a drop of a different constraint does not make this one safe');
  assert.equal(shapeOf('ALTER TABLE other ADD CONSTRAINT ck_x CHECK (a > 0)'), null,
    'the pair must match on TABLE — the same constraint name on another table is another constraint');
  dropped.clear();

  const unsafe = [];
  let checked = 0;
  for (const statement of statements) {
    if (!statement) continue;
    checked++;
    const drop = statement.match(constraintDrop);
    if (drop) dropped.add(`${drop[1]}.${drop[2]}`);
    if (!shapeOf(statement)) unsafe.push(statement.replace(/\s+/g, ' ').slice(0, 110));
  }
  // Anti-vacuity, two floors because they fail differently: the first catches a splitter that has
  // stopped finding statements, the second a matcher that has stopped recognising the file's own
  // dominant shape (either would report a clean sweep over a schema full of hazards).
  assert(checked > 500, `the splitter found only ${checked} statements — it has stopped reading schema.sql`);
  assert(statements.filter((s) => /^CREATE TABLE IF NOT EXISTS\b/i.test(s)).length > 200,
    'the classifier no longer recognises the file\'s dominant shape');
  assert.equal(unsafe.length, 0,
    `${unsafe.length} statement(s) in schema.sql are not safe to run a second time — the whole file is `
    + 'applied at every boot inside one implicit transaction, so each of these is a crash loop on any '
    + `existing database:\n  ${unsafe.join('\n  ')}`);
  console.log(`  ✓ all ${checked} statements in schema.sql are re-apply safe (the file is applied at every boot)`);
}

// ── 2. clean no-op on a FRESH DB (every column already exists) ──
const mem = newDb();
registerPgMemCompatibility(mem, DataType);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
await pool.query(SCHEMA);
const fresh = await migrateColumns(pool, SCHEMA);
assert.equal(fresh.total, stmts.length, 'runs every derived statement');
assert.equal(fresh.failed, 0, `a fresh DB is a clean no-op — 0 statements should fail (got ${fresh.failed})`);
await dbModule.migrateTask5BallotV2(pool, { compatibility: 'pg-mem' });
await dbModule.migrateTask5BallotV2(pool, { compatibility: 'pg-mem' });

// The production orchestration seam is what runs while makeDb holds the existing advisory lock:
// schema -> generic safe columns -> targeted fail-closed authority -> schema stamp.
{
  const bootMem = newDb();
  registerPgMemCompatibility(bootMem, DataType);
  const { Pool: BootPool } = bootMem.adapters.createPg();
  const bootPool = new BootPool();
  const statements = [];
  const query = bootPool.query.bind(bootPool);
  const client = {
    async query(sql, params = []) {
      statements.push(sql);
      return query(sql, params);
    },
  };
  assert.equal(typeof dbModule.migrateSchemaUnderLock, 'function',
    'boot exposes one tested schema ordering seam for the existing advisory lock');
  await dbModule.migrateSchemaUnderLock(client, {
    schemaText: SCHEMA, compatibility: 'pg-mem',
  });
  const targeted = statements.findIndex((sql) => sql.includes('task5_ballot_v2_targeted_migration'));
  const h2Targeted = statements.findIndex((sql) => (
    sql.includes('rwa_health_overlay_v2_targeted_migration')
  ));
  const lastGeneric = statements
    .slice(0, targeted)
    .findLastIndex((sql) => /^ALTER TABLE .* ADD COLUMN IF NOT EXISTS /i.test(sql));
  const stamp = statements.findIndex((sql) => sql.includes('SELECT app_version FROM schema_meta'));
  assert(lastGeneric >= 0 && targeted > lastGeneric && h2Targeted > targeted && stamp > h2Targeted,
    'generic columns, Task 5 authority, and H2 authority run before the schema stamp');
  await bootPool.end();
}

// ── 3. the actual fix: an "old" DB missing a later-added column gets it back ──
const has = async (t, c) => { try { await pool.query(`SELECT ${c} FROM ${t} LIMIT 0`); return true; } catch { return false; } };
await pool.query('ALTER TABLE track_bets DROP COLUMN odds');       // simulate an in-place upgrade gap
await pool.query('ALTER TABLE characters DROP COLUMN wire_tier');
assert.equal(await has('track_bets', 'odds'), false, 'the "old" DB is missing odds');
assert.equal(await has('characters', 'wire_tier'), false, 'the "old" DB is missing wire_tier');
const fixed = await migrateColumns(pool, SCHEMA);
assert.equal(fixed.failed, 0, 're-migration adds the missing columns without error');
assert.equal(await has('track_bets', 'odds'), true, 'odds is restored by the migration');
assert.equal(await has('characters', 'wire_tier'), true, 'wire_tier is restored by the migration');
// idempotent: running again is still a clean no-op
assert.equal((await migrateColumns(pool, SCHEMA)).failed, 0, 're-running the migration is idempotent');

// ── 4. MED-2 completeness guard: every `character_id` table has a KNOWN death disposition ──
// The schema has zero FKs — referential integrity on death is 100% the runEstate wipe loop (+ custom
// wipers + the escrow-resolve `*:death` burns). That's complete today, but a FUTURE character_id table a
// developer forgets to wipe orphans SILENTLY — invisible to Postgres AND pg-mem (this is exactly how the
// historical port_intercepts / npc_hits / convoy_ambushes orphans slipped in). An FK ON DELETE CASCADE is
// the WRONG tool here: on death the character row is KEPT (`alive=false`), never DELETE'd, so a cascade
// never fires — and FKs risk breaking the pg-mem test path. Instead, fail CI CLOSED when a new
// character_id table isn't classified. Categories: wiped (runEstate loop / a death-path DELETE), special
// (a custom *AtDeath wiper in another module), escrow (self-contained snapshot settled at the worker
// resolve with a `*:death` burn — deliberately NOT wiped so the frozen field resolves), ledger/log
// (immutable §10.4/audit/historical rows — intentionally never wiped; a dead id is a valid historical ref).
const DISPOSITION = {
  batches: 'wiped', blackjack_hands: 'wiped', boats: 'wiped', businesses: 'wiped', cars: 'wiped',
  character_assets: 'wiped', character_cargo: 'wiped', character_guns: 'wiped', character_items: 'wiped',
  character_rackets: 'wiped', character_skills: 'wiped', convoy_ambushes: 'wiped', crew_heist_members: 'wiped',
  daily_progress: 'wiped', fight_bets: 'wiped', makings: 'wiped', missions_done: 'wiped', npc_errands: 'wiped',
  npc_favors: 'wiped', npc_gain: 'wiped', npc_grudges: 'wiped', npc_leads: 'wiped', npc_standing: 'wiped',
  wage_snapshots: 'wiped', // the Street Wage baseline dies with the street — the heir enrolls fresh (no inherited gain window)
  campaign_progress: 'wiped', // FIVE PILLARS #4: a fresh street walks the stories again (the roguelike spine)
  soldiers: 'wiped', // XCOM soldiers die with the street — a fresh street hires fresh muscle (memorial included)
  digs: 'wiped', // secret-dig cooldowns die with the digger (secrets themselves are holder_character-keyed, wiped in runEstate)
  family_aggro: 'wiped', // THE MANHUNT: a dead raider isn't hunted — the pending family retaliation on them is cleared in runEstate
  numbers_tickets: 'wiped', pen_break_members: 'wiped', pen_contraband: 'wiped', port_intercepts: 'wiped',
  racers: 'wiped', stash: 'wiped', track_bets: 'wiped', world_raid_members: 'wiped',
  fighters: 'special', gang_members: 'special', speakeasy_patrons: 'special',
  futurity_runners: 'escrow', grand_prix_entries: 'escrow', poker_entries: 'escrow', stakes_entries: 'escrow', track_entries: 'escrow',
  transactions: 'ledger', rng_audit: 'ledger', notifications: 'log',
  clue_scrolls: 'wiped', // the treasure trail dies with the street (the heir starts a fresh hunt)
  // THE SHIPMENT (scarcity §3): the per-player daily take. The MATERIAL is a character column, so it
  // dies with the street by construction; this is the counter that gated it, and it dies with it —
  // the heir is a new id and takes their own share. (bespoke_pieces + firsts are ACCOUNT-keyed and
  // survive death on purpose, so the guard never sees them.)
  shipment_takes: 'wiped',
  masteries: 'wiped', // THE TRADES die with the street (the estate echoes HEIR_KEEP_BPS of each track's XP to the heir); mastery_legend is account-keyed and survives by construction
  character_traits: 'wiped', // the level-50 trait dies with the street (the DYNAST echo is read BEFORE the wipe)
  character_disciplines: 'wiped', // THE REGIMEN: discipline XP dies with the street (the heir hits the gym fresh)
  npc_drills: 'wiped', // THE REGIMEN: daily trainer-drill claims are the street's own day — die with them
  hustles: 'wiped', // THE HUSTLE: the daily three-stop chain is the street's own day — dies with them (the heir draws fresh work)
  pen_talks: 'wiped', // PEN step six: the daily yard-character conversation is the street's own day
  corner_jobs: 'wiped', // STREET LIFE: the district quest board is the street's own day — dies with them
  corner_chains: 'wiped', // the block's standing job is a WEEK of showing up — a new man starts it cold
  contact_calls: 'wiped', // STREET LIFE: an open contact call dies with the street (no escrow — the pay only moves at fulfilment; `contacts` itself is account-keyed and survives by construction)
  primetime_rally: 'wiped', // PRIME TIME: a night's answer is the street's own — a dead answerer isn't paid (no ledger row was written; the worker's JOIN skips a wiped row)
  primetime_happy: 'wiped', // PRIME TIME HAPPY HOUR: rounds bought tonight are the street's own — no ledger owed (value paid immediately)
  rigs: 'wiped', // CONVOY Tier-4: the hauler dies with the street (the cars/boats precedent)
  route_notoriety: 'wiped', // TIER C: per-lane heat is the street's own reputation — dies with them (the heir runs clean lanes)
  poker_ring_seats: 'special', // RING POKER: wipeRingAtDeath folds the seat + BURNS the stack (casino:ring:death) under the table lock — never a bare DELETE (the stack is escrowed cash)
  chat_messages: 'log', // troll-box lines keep their name snapshot — a dead man's words stand (7d worker retention)
  nft_reimports: 'log', // NFT RE-IMPORT (Option A): a chain-event audit record keyed by the log ref. `applied_character` RECORDS where the re-created car went (it dies via the normal cars estate path); this record persists past that death — the chat_messages precedent.
  world_operation_roles: 'ledger', // pinned assignment: a dead assignee invalidates/abandons the operation; replacing the ID would let an heir impersonate the role
  world_operation_contributions: 'ledger', // immutable participation audit; the operation close path returns escrow and preserves who contributed
  // ── the `%_character` half (audit F4): sixteen tables that scope themselves by a named role rather
  // than by `character_id`, and were invisible to this guard until it learned the suffix. Every one is
  // handled today — that is precisely why the blind spot mattered: nothing was ENFORCING it.
  wiretaps: 'wiped', wire_informants: 'wiped', wire_watches: 'wiped', // die with EITHER party (estate)
  secrets: 'wiped', informants: 'wiped',                             // dirt dies both ways; the flip collapses
  bounties: 'special', bounty_contributors: 'special', // escrow SUMmed under lock then burned death:bounty
  listings: 'special',        // M3 exchange: cb/ammo escrow forfeited (death:escrow) before the DELETE
  market_listings: 'special', // voidListingsAtDeath — bids refunded, a dead poster's own escrow burns
  favors: 'special',          // voidFavorsAtDeath — the loot surface, then whatever's left burns
  loans: 'special',           // voidLoansAtDeath — a dead LENDER's claim passes to the heir, not the void
  convoys: 'special',         // freight scatters (status='lost'), cargo deleted — never a bare row DELETE
  speakeasies: 'special',     // wipeSpeakeasyAtDeath — the club goes dark and the district reopens
  crew_heists: 'special', pen_breaks: 'special', world_raids: 'special', // a dead leader's plan is ABANDONED

  // SIGN-OFF 2.4: the funding family's roster snapshot, keyed to the POT rather than to the listed
  // member — so it is torn down with the pot (claim / the family cancelling its share / the expiry
  // sweep / the target's estate), not with the member. A listed member's own death leaves a row that
  // can never do anything (a corpse cannot claim), and the pot's own teardown reaps it.
  bounty_gang_roster: 'special',

  // ── the `%_char` / bare-role / `%_fighter` half (night audit F2): five more tables the parser could
  // not see. All five were already handled — the defect was the guard's silence, not the code's.
  searches: 'wiped',        // the hunt dies with EITHER party (estate deletes hunter=$1 OR target=$1)
  boxing_title: 'singleton', // ONE row, forever: wipeFighterAtDeath VACATES the belt (holder → NULL)
  boxing_bouts: 'special',  // cancelMainEventsAtDeath cancels a dead principal's booked card + refunds
  boxing_bets: 'escrow',    // refunded on a cancelled card; at resolve a dead bettor's stake burns
  futurity_bets: 'escrow',  // same shape — resolveFuturity LEFT JOINs `alive` and burns a dead stake
};
// SCOPE: this guard covers the literal `character_id` column convention (42 tables). Tables that
// reference a character via a DIFFERENTLY-NAMED column (npc_hits payer/target, searches hunter/target,
// wiretaps/wire_informants/wire_watches watcher/target, informants, kill_log, vendettas, feud_peace_offers,
// loans lender/borrower_character, market_listings, bounties/bounty_contributors, convoys owner_character…)
// are outside the parser's scope here — they were verified complete by the R30 schema audit + are cleaned
// by NAMED death handlers (voidLoansAtDeath / voidListingsAtDeath / the runEstate special DELETEs). The
// value of this guard is the common case: a NEW `character_id` table added without a wipe fails CI closed.
// parse schema.sql for every table whose body declares a `character_id` column
const charTables = new Set();
{
  const head = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let mm;
  const clean = SCHEMA.replace(/--[^\n]*/g, '');
  while ((mm = head.exec(clean))) {
    let depth = 1, body = '', i = head.lastIndex;
    for (; i < clean.length && depth > 0; i++) { const ch = clean[i]; if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) break; } body += ch; }
    head.lastIndex = i;
    // (audit F4) `character_id` is the COMMON name for a character FK, not the only one. Sixteen
    // tables scope themselves with `poster_character` / `leader_character` / `owner_character` and
    // friends, and every one of them was INVISIBLE to a guard whose stated job is to fail CI closed
    // on an unclassified character-scoped table. All sixteen happen to be handled today, which is
    // exactly the problem: a guard that cannot see the class it guards reads as a clean bill of
    // health. Any `%_character` column counts.
    //
    // (night audit F2) And that was still not the whole convention. THREE more shapes existed —
    // `%_char` (`holder_char`, `npc_character`'s sibling), the bare role name (`hunter`), and a
    // typed role (`holder_fighter`) — covering five tables the guard could not see: searches,
    // boxing_title, boxing_bouts, boxing_bets, futurity_bets. All five are handled correctly today;
    // the defect was that the success line claimed a completeness it did not have, and a NEW table
    // in the established `_char` house style would have failed OPEN. Third occurrence of the class
    // this guard's own comment names, which is the argument for matching the family rather than
    // enumerating members: a suffix rule generalises, a list of five does not.
    if (/^\s*(character_id|[a-z0-9_]+_(character|char|fighter)|hunter)\b/m.test(body)) charTables.add(mm[1]);
  }
}
// (a) every character_id table is classified; no stale classifications
const unclassified = [...charTables].filter((t) => !DISPOSITION[t]);
assert.equal(unclassified.length, 0, `unclassified character_id table(s) — a dead street would ORPHAN them: ${unclassified.join(', ')}. Wipe in runEstate (add to DISPOSITION 'wiped'/'special') or document as 'escrow'/'ledger'.`);
const stale = Object.keys(DISPOSITION).filter((t) => !charTables.has(t));
assert.equal(stale.length, 0, `stale DISPOSITION entr(y/ies) no longer a character_id table: ${stale.join(', ')}`);
// (b) every 'wiped'/'special' table actually has a DELETE FROM somewhere in src/ (classification ⇒ code)
const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const allSrc = srcText();  // RECURSIVE — a flat listing missed src/social/ and hid the whole estate wipe
for (const [t, kind] of Object.entries(DISPOSITION)) {
  // a table is "cleaned on death" if it's DELETE'd by name (custom wipers: DELETE FROM fighters) OR it
  // appears as a quoted name in the runEstate wipe-loop array (`for (const t of ['businesses', …])` →
  // `DELETE FROM ${t}`). Either proves the death path references it; a NEW wiped table someone forgets to
  // wire in matches neither → this fails.
  // Death cleanup takes THREE shapes in this tree, and only the first was recognised: a DELETE, a
  // resolving status UPDATE (a convoy is 'lost', a plan 'abandoned', a favor 'cancelled' — the row
  // stays as the record of what happened), or the table's name listed in the estate's own wipe loop.
  // `favors` is handled by an UPDATE and tripped this; the four tables already relying on a status
  // UPDATE passed only because their names happened to appear quoted somewhere else in src/.
  if (kind === 'wiped' || kind === 'special') assert(
    new RegExp(`DELETE FROM ${t}\\b|UPDATE ${t} SET status=|['"]${t}['"]`).test(allSrc),
    `${t} is classified '${kind}' but no death-cleanup DELETE / resolving status UPDATE for it exists in src/ — the estate wipe is missing`);
  // A FOURTH shape, found the same way the third was: `boxing_title` holds ONE row forever and a
  // death does not remove a row from it — it clears the dead player's claim ON it (the belt is
  // vacated). Neither a DELETE nor a status UPDATE, and calling it 'special' made the guard demand
  // cleanup that would be wrong to write. So a singleton is its own contract: it must be UPDATEd by
  // the death path, and it must NOT be deleted from — deleting the row would remove the belt itself.
  if (kind === 'singleton') {
    assert(new RegExp(`UPDATE ${t} SET`).test(allSrc),
      `${t} is classified 'singleton' but the death path never UPDATEs it — nothing releases a dead holder's claim`);
    assert(!new RegExp(`DELETE FROM ${t}\\b`).test(allSrc),
      `${t} is a 'singleton' but something DELETEs from it — a singleton's row is the thing itself, not a per-player record`);
  }
}

// ── 4b. Phase 1 generic-owner death disposition (fail closed) ────────────────────────────────
// The legacy guard above deliberately follows character-shaped columns. Phase 1 adds a second,
// generic ownership vocabulary that must remain immutable historical state across death and
// replacement. Keep both the complete table census and every generic owner/depositor tuple role
// derived from the bounded schema section: adding a table or a new *_scope role without an explicit
// classification fails CI. This is intentionally stronger than an expected-list assertion, which
// could omit a new owner-bearing column and silently pass.
const PHASE1_DISPOSITION = {
  item_stacks: 'historical_owner',
  item_instances: 'historical_owner',
  item_events: 'historical_audit',
  item_mutation_guards: 'historical_audit',
  operation_escrow: 'operation_lifecycle',
  mystery_instances: 'historical_owner',
  mystery_node_state: 'child_history',
  mystery_choices: 'child_history',
  world_operations: 'operation_lifecycle',
  world_operation_roles: 'historical_audit',
  world_operation_node_state: 'child_history',
  world_operation_contributions: 'historical_audit',
};
const PHASE1_OWNER_TUPLE_DISPOSITION = {
  'item_stacks.owner_scope/owner_id': 'historical_owner',
  'item_instances.owner_scope/owner_id': 'historical_owner',
  'item_events.from_owner_scope/from_owner_id': 'historical_audit',
  'item_events.to_owner_scope/to_owner_id': 'historical_audit',
  'item_mutation_guards.owner_scope/owner_id': 'historical_audit',
  'operation_escrow.owner_scope/operation_id': 'operation_lifecycle',
  'operation_escrow.depositor_scope/depositor_id': 'historical_owner',
  'mystery_instances.owner_scope/owner_id': 'historical_owner',
};
{
  const start = SCHEMA.indexOf('-- ── WORLD-GRAPH ITEM ECONOMY');
  const end = SCHEMA.indexOf('-- ── AUTHORED CONTENT SUPPLY', start);
  assert(start >= 0 && end > start, 'schema must retain the bounded Phase 1 world-graph section');
  const phase1Schema = SCHEMA.slice(start, end);
  assert.match(phase1Schema, /immutable historical ledger state, not an\s+-- estate asset/,
    'Phase 1 schema must document that generic owner tuples are historical, not estate assets');
  assert.match(phase1Schema, /Death\/replacement never wipes, rewrites, auto-inherits, or duplicates/,
    'Phase 1 schema must document the no-inheritance death policy');

  const tables = new Map();
  const head = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match;
  const clean = phase1Schema.replace(/--[^\n]*/g, '');
  while ((match = head.exec(clean))) {
    let depth = 1;
    let body = '';
    let i = head.lastIndex;
    for (; i < clean.length && depth > 0; i++) {
      const ch = clean[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
      body += ch;
    }
    head.lastIndex = i;
    tables.set(match[1], body);
  }

  const unclassifiedTables = [...tables.keys()].filter((table) => !PHASE1_DISPOSITION[table]);
  const staleTables = Object.keys(PHASE1_DISPOSITION).filter((table) => !tables.has(table));
  assert.deepEqual(unclassifiedTables, [],
    `unclassified Phase 1 table(s): ${unclassifiedTables.join(', ')} — classify the death/lifecycle disposition before shipping`);
  assert.deepEqual(staleTables, [],
    `stale Phase 1 disposition table(s): ${staleTables.join(', ')}`);

  const ownerTuples = new Set();
  for (const [table, body] of tables) {
    const columns = new Set();
    for (const line of body.split('\n')) {
      const column = line.match(/^\s*([a-z_][a-z0-9_]*)\s+[A-Z]/i)?.[1];
      if (column && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(column)) columns.add(column);
    }
    for (const scopeColumn of columns) {
      let idColumn = null;
      if (scopeColumn === 'owner_scope') {
        idColumn = columns.has('owner_id') ? 'owner_id'
          : (table === 'operation_escrow' && columns.has('operation_id') ? 'operation_id' : null);
      } else if (scopeColumn === 'from_owner_scope') idColumn = 'from_owner_id';
      else if (scopeColumn === 'to_owner_scope') idColumn = 'to_owner_id';
      else if (scopeColumn === 'depositor_scope') idColumn = 'depositor_id';
      if (idColumn) {
        assert(columns.has(idColumn), `${table}.${scopeColumn} is missing its ${idColumn} tuple half`);
        ownerTuples.add(`${table}.${scopeColumn}/${idColumn}`);
      }
    }
  }
  const unclassifiedTuples = [...ownerTuples].filter((tuple) => !PHASE1_OWNER_TUPLE_DISPOSITION[tuple]);
  const staleTuples = Object.keys(PHASE1_OWNER_TUPLE_DISPOSITION).filter((tuple) => !ownerTuples.has(tuple));
  assert.deepEqual(unclassifiedTuples, [],
    `unclassified Phase 1 generic owner/depositor tuple(s): ${unclassifiedTuples.join(', ')}`);
  assert.deepEqual(staleTuples, [],
    `stale Phase 1 owner/depositor disposition(s): ${staleTuples.join(', ')}`);

  // The classifications above describe preservation; this source guard proves the production death
  // path honors it. There are deliberately no Phase 1 death mutations in the approved ledger. A
  // future exception must name its exact handler, verb, and table here, so adding a generic-owner
  // table to runEstate (directly or through a named death helper) cannot silently become inheritance.
  const PHASE1_DEATH_MUTATION_APPROVALS = new Set([]);
  const lexicalMask = (source, { keepStrings = false } = {}) => {
    const out = [...source];
    const blank = (index) => { if (!/\r|\n/.test(out[index])) out[index] = ' '; };
    let state = 'code';
    let quote = null;
    let regexClass = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];
      if (state === 'line-comment') {
        if (ch === '\n') state = 'code'; else blank(i);
        continue;
      }
      if (state === 'block-comment') {
        blank(i);
        if (ch === '*' && next === '/') { blank(++i); state = 'code'; }
        continue;
      }
      if (state === 'string') {
        if (!keepStrings) blank(i);
        if (ch === '\\') { if (!keepStrings && i + 1 < source.length) blank(i + 1); i++; continue; }
        if (ch === quote) state = 'code';
        continue;
      }
      if (state === 'regex') {
        blank(i);
        if (ch === '\\') { if (i + 1 < source.length) blank(++i); continue; }
        if (ch === '[') regexClass = true;
        else if (ch === ']') regexClass = false;
        else if (ch === '/' && !regexClass) {
          state = 'code';
          while (/[a-z]/i.test(source[i + 1] || '')) blank(++i);
        }
        continue;
      }
      if (ch === '/' && next === '/') { blank(i); blank(++i); state = 'line-comment'; continue; }
      if (ch === '/' && next === '*') { blank(i); blank(++i); state = 'block-comment'; continue; }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch; state = 'string'; if (!keepStrings) blank(i);
        continue;
      }
      if (ch === '/') {
        let previous = i - 1;
        while (previous >= 0 && /\s/.test(source[previous])) previous--;
        if (previous < 0 || /[=(:,!&|?{};\[]/.test(source[previous])) {
          blank(i); state = 'regex'; regexClass = false;
        }
      }
    }
    return out.join('');
  };
  const functionBlock = (source, open, label) => {
    const code = lexicalMask(source);
    let depth = 1;
    for (let i = open + 1; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}' && --depth === 0) return source.slice(open + 1, i);
    }
    assert.fail(`death helper ${label} has an unterminated block body`);
  };

  // Build a source-wide named-function index, then crawl every statically resolvable bare helper
  // call starting at runEstate. This includes helpers such as recordDeath, refundPot, removeMember,
  // and checkScandal rather than trusting an `*AtDeath` naming convention. Ambiguous names include
  // every definition, which is the fail-closed choice for a source guard.
  const functionIndex = new Map();
  for (const file of walkSrc()) {
    const source = fs.readFileSync(file, 'utf8');
    const code = lexicalMask(source);
    const heads = [
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
      /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g,
    ];
    for (const head of heads) {
      for (const match of code.matchAll(head)) {
        const open = code.indexOf('{', match.index + match[0].length - 1);
        const entry = { name: match[1], file, source, open };
        (functionIndex.get(entry.name) || functionIndex.set(entry.name, []).get(entry.name)).push(entry);
      }
    }
  }
  assert(functionIndex.has('runEstate'), 'runEstate must remain a statically crawlable named function');
  const deathSources = [];
  const reachableNames = new Set();
  const queue = ['runEstate'];
  while (queue.length) {
    const name = queue.shift();
    if (reachableNames.has(name)) continue;
    reachableNames.add(name);
    for (const entry of functionIndex.get(name) || []) {
      const body = functionBlock(entry.source, entry.open, `${entry.file}:${entry.name}`);
      deathSources.push({ name: entry.name, file: entry.file, body });
      const executable = lexicalMask(body);
      for (const call of executable.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (functionIndex.has(call[1]) && !reachableNames.has(call[1])) queue.push(call[1]);
      }
    }
  }
  for (const helper of [
    'clearInboundPointers', 'recordDeath', 'recordDeedEvent', 'checkScandal', 'refundPot',
    'removeMember', 'rememberedSkills', 'abandonRaidsAtDeath', 'voidListingsAtDeath',
  ]) assert(reachableNames.has(helper), `runEstate call-graph crawl must include ${helper}`);

  const normalizedVerb = (verb) => verb.toUpperCase().trim().replace(/\s+/g, '_');
  const mutationsFor = (handler, body) => {
    const mutations = [];
    const sql = lexicalMask(body, { keepStrings: true });
    for (const match of sql.matchAll(/\b(DELETE\s+FROM|UPDATE|INSERT\s+INTO|MERGE(?:\s+INTO)?)\s+([a-z_][a-z0-9_]*)\b/gi)) {
      mutations.push({ handler, verb: normalizedVerb(match[1]), table: match[2] });
    }
    const boundedVariables = new Set();
    for (const match of sql.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+\[([\s\S]*?)\]\s*\)[\s\S]{0,160}?client\.query\(\s*`(DELETE\s+FROM|UPDATE|INSERT\s+INTO|MERGE(?:\s+INTO)?)\s+\$\{\1\}/gi)) {
      boundedVariables.add(match[1]);
      for (const tableMatch of match[2].matchAll(/['"]([a-z_][a-z0-9_]*)['"]/gi)) {
        mutations.push({ handler, verb: normalizedVerb(match[3]), table: tableMatch[1] });
      }
    }
    for (const match of sql.matchAll(/\b(DELETE\s+FROM|UPDATE|INSERT\s+INTO|MERGE(?:\s+INTO)?)\s+\$\{([^}]+)\}/gi)) {
      if (!boundedVariables.has(match[2].trim())) {
        mutations.push({ handler, verb: normalizedVerb(match[1]), table: `<dynamic:${match[2].trim()}>` });
      }
    }
    return mutations;
  };
  assert.deepEqual(mutationsFor('tripwire', [
    "await client.query('INSERT INTO item_stacks (owner_scope) VALUES ($1)', ['character']);",
    "await client.query('MERGE INTO operation_escrow target USING source ON false WHEN NOT MATCHED THEN INSERT DEFAULT VALUES');",
  ].join('\n')).map(({ handler, verb, table }) => `${handler}:${verb}:${table}`), [
    'tripwire:INSERT_INTO:item_stacks',
    'tripwire:MERGE_INTO:operation_escrow',
  ], 'the death-policy source tripwire must detect Phase 1 INSERT and MERGE statements');

  const mutations = deathSources.flatMap(({ name, body }) => mutationsFor(name, body));
  const phase1DeathMutations = mutations
    .filter(({ table }) => tables.has(table) || table.startsWith('<dynamic:'))
    .map(({ handler, verb, table }) => `${handler}:${verb}:${table}`);
  const unapprovedDeathMutations = phase1DeathMutations
    .filter((mutation) => !PHASE1_DEATH_MUTATION_APPROVALS.has(mutation));
  const staleDeathApprovals = [...PHASE1_DEATH_MUTATION_APPROVALS]
    .filter((approval) => !phase1DeathMutations.includes(approval));
  assert.deepEqual(unapprovedDeathMutations, [],
    `Phase 1 historical owner state must not be mutated by death: ${unapprovedDeathMutations.join(', ')}`);
  assert.deepEqual(staleDeathApprovals, [],
    `stale Phase 1 death-mutation approval(s): ${staleDeathApprovals.join(', ')}`);

  const phase1MigrationColumns = {
    item_stacks: 'owner_scope', item_instances: 'id', item_events: 'sequence',
    item_mutation_guards: 'idempotency_key', operation_escrow: 'item_id', mystery_instances: 'id',
    mystery_node_state: 'instance_id', mystery_choices: 'instance_id', world_operations: 'id',
    world_operation_roles: 'operation_id', world_operation_node_state: 'operation_id',
    world_operation_contributions: 'operation_id',
  };
  for (const [table, column] of Object.entries(phase1MigrationColumns)) {
    assert(stmts.some((statement) => new RegExp(`^ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column}\\b`, 'i').test(statement)),
      `${table}.${column} must be covered by the idempotent migration derivation`);
  }

  const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const backupSource = fs.readFileSync(path.join(rootDir, 'tools', 'backup.sh'), 'utf8');
  const backupSelftest = fs.readFileSync(path.join(rootDir, 'tools', 'backup-selftest.sh'), 'utf8');
  for (const table of tables.keys()) {
    assert(backupSource.includes(table), `backup.sh must require Phase 1 table ${table}`);
    assert(backupSelftest.includes(table), `backup selftest must seed and verify Phase 1 table ${table}`);
  }
}

// ── (c) DISTRICT → GANG lock order (full-sweep red-team, lens B) ──────────────────────────────
// Three paths hold BOTH a `districts` and a `gangs` row lock: seizeDistrict (social/gangs.js),
// establishRacket (territory.js) and buildSov (sov.js). Two took districts first; buildSov took
// gangs first, on the reasoning that "no sov path ever locks district THEN gang" — which analysed
// the wrong pair. A cycle needs ANY path in the tree to take the other order, and both siblings do,
// so a boss seizing a district while an underboss built on it was a live AB-BA (masked by the
// 40P01 → `contention` retry). Reasoning about this by hand is what produced the bug; this derives
// it. Anything holding both must take DISTRICTS first.
//
// Anchored on COLUMN-0 function declarations: an earlier hand-rolled version of this analysis bound
// locks to inner arrow-function names and reported fake cycles.
{
  const files = [['src/sov.js'], ['src/territory.js'], ['src/social/gangs.js'], ['src/economy.js'],
    ['src/world.js'], ['src/commission.js'], ['src/diplomacy.js']].map(([p]) => p);
  const offenders = [], both = [], unreadable = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(srcDir, '..', rel), 'utf8');
    const lines = text.split('\n');
    let fn = null, body = [];
    const flush = () => {
      if (!fn) return;
      const src = body.join('\n');
      // a lock = `FROM <table> … FOR UPDATE` in one statement; record first occurrence of each table
      const at = (t) => {
        const m = src.match(new RegExp(`FROM ${t}\\b[\\s\\S]{0,200}?FOR UPDATE`));
        return m ? m.index : -1;
      };
      const dIdx = at('districts'), gIdx = at('gangs');
      if (dIdx >= 0 && gIdx >= 0) {
        both.push(`${rel}:${fn}`);
        if (gIdx < dIdx) offenders.push(`${rel}:${fn} locks gangs before districts`);
      }
      fn = null; body = [];
    };
    for (const line of lines) {
      const m = line.match(/^(?:export )?(?:async )?function (\w+)\s*\(/);
      if (m) { flush(); fn = m[1]; }
      else if (/^(?:export )?(?:const|let|class) /.test(line)) flush();
      if (fn) body.push(line);
    }
    flush();
    // "counted, never silently skipped": a file we scan that declares no top-level function at all
    // would silently contribute nothing — assert we actually parsed something out of each.
    if (!/^(?:export )?(?:async )?function \w+\s*\(/m.test(text)) unreadable.push(rel);
  }
  assert.equal(unreadable.length, 0, `lock-order scan parsed no top-level function from: ${unreadable.join(', ')} — the scanner, not the code, is broken`);
  assert(both.length >= 3, `expected ≥3 functions holding both a districts and a gangs lock, found ${both.length} (${both.join(', ')}) — the scanner stopped seeing the pair, so this guard has gone vacuous`);
  assert.equal(offenders.length, 0, `districts→gangs lock-order inversion (AB-BA deadlock vs seizeDistrict/establishRacket): ${offenders.join('; ')}`);
}

// ── 6. CN-6A is a new-table migration with an independent, read-only authority cursor ──
// These tables are deliberately not folded into the Task-5 getter cursor. A schema that creates only
// some of them can appear to boot and then either lose replay evidence or make readiness a mutable flag.
// Keep the corpus explicit: adding a second Registry lifecycle cursor is an architecture change, not a
// harmless table addition.
{
  const expectedTables = [
    'rwa_registry_lifecycle_lock_v2',
    'rwa_registry_lifecycle_checkpoint_v2',
    'rwa_registry_lifecycle_inbox_v2',
    'rwa_registry_activation_instances_v2',
    'rwa_registry_asset_lifecycle_current_v2',
    'rwa_registry_publisher_history_v2',
    'rwa_registry_publisher_current_v2',
    'rwa_registry_ballot_events_v2',
    'rwa_registry_lifecycle_event_results_v2',
    'rwa_registry_lifecycle_runtime_v2',
    'rwa_registry_lifecycle_attempts_v2',
  ];
  const tableBody = (table) => {
    const match = SCHEMA.match(new RegExp(
      `CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i',
    ));
    assert(match, `CN-6A schema must create ${table}`);
    return match[1];
  };
  const requiredColumns = {
    rwa_registry_lifecycle_lock_v2: ['id', 'created_at'],
    rwa_registry_lifecycle_checkpoint_v2: [
      'consumer_key', 'chain_id', 'registry_address', 'start_block_number',
      'last_applied_block_number', 'last_applied_block_hash', 'last_observation_hash',
      'finalized_horizon_block_number', 'finalized_horizon_block_hash', 'caught_up', 'halted',
      'verified_at', 'ready_verified_at',
    ],
    rwa_registry_lifecycle_inbox_v2: [
      'inbox_id', 'consumer_key', 'chain_id', 'contract_address', 'block_number',
      'block_hash', 'block_timestamp', 'transaction_hash', 'transaction_index',
      'log_index', 'topic0', 'topics_json', 'data_hex', 'event_kind', 'decoded_hash',
      'observation_hash', 'inserted_at',
    ],
    rwa_registry_activation_instances_v2: [
      'chain_id', 'registry_address', 'asset_version_key', 'activation_generation',
      'activation_block_number', 'activation_block_hash', 'activation_transaction_hash',
      'activation_log_index', 'catalog_version', 'review_id', 'evidence_hash',
      'approved_at', 'valid_until', 'included_at', 'local_match',
      'deactivation_block_number', 'deactivation_block_hash',
    ],
    rwa_registry_asset_lifecycle_current_v2: [
      'chain_id', 'registry_address', 'asset_version_key', 'registered', 'active',
      'registry_index', 'activation_generation', 'catalog_version', 'updated_at',
    ],
    rwa_registry_publisher_history_v2: [
      'chain_id', 'registry_address', 'publisher', 'block_number', 'block_hash',
      'transaction_hash', 'log_index',
    ],
    rwa_registry_publisher_current_v2: [
      'chain_id', 'registry_address', 'publisher', 'block_number', 'block_hash',
      'transaction_hash', 'log_index',
    ],
    rwa_registry_ballot_events_v2: [
      'chain_id', 'registry_address', 'ballot_day', 'asset_version_key', 'token_address',
      'token_decimals', 'tally_hash', 'catalog_version', 'max_eth_wei',
      'purchase_until', 'activation_generation', 'block_number', 'block_hash',
      'transaction_hash', 'log_index',
    ],
    rwa_registry_lifecycle_event_results_v2: [
      'inbox_id', 'event_kind', 'disposition', 'created_at',
    ],
    rwa_registry_lifecycle_runtime_v2: [
      'id', 'consumer_key', 'chain_id', 'registry_address', 'start_block_number',
      'last_applied_block_number', 'last_applied_block_hash',
      'finalized_horizon_block_number', 'finalized_horizon_block_hash', 'sync_in_progress',
      'attempt_id', 'last_attempt_at', 'last_success_at', 'ready_verified_at',
      'caught_up', 'halted', 'failure_code', 'unresolved_incident_count',
      'last_incident_id',
    ],
    rwa_registry_lifecycle_attempts_v2: [
      'attempt_id', 'status', 'started_at', 'ended_at', 'failure_code',
    ],
  };
  const bodies = Object.fromEntries(expectedTables.map((table) => [table, tableBody(table)]));
  for (const [table, columns] of Object.entries(requiredColumns)) {
    for (const column of columns) {
      assert.match(bodies[table], new RegExp(`\\b${column}\\b`, 'i'),
        `CN-6A ${table} must retain authority column ${column}`);
    }
  }

  // The essential constraints are named by their semantic boundary rather than by line number so a
  // harmless schema reflow cannot weaken the test. These are the constraints that prevent the new
  // consumer from becoming a second mutable Registry authority.
  assert.match(bodies.rwa_registry_lifecycle_checkpoint_v2,
    /consumer_key\s+TEXT[\s\S]{0,100}?CHECK\s*\(consumer_key\s*=\s*'rwa_registry_lifecycle_v2'\)/i,
    'CN-6A checkpoint permanently binds the literal consumer key');
  assert.match(bodies.rwa_registry_lifecycle_checkpoint_v2,
    /chain_id\s+NUMERIC\(78,0\)[\s\S]{0,100}?CHECK\s*\(chain_id\s*=\s*4663\)/i,
    'CN-6A checkpoint permanently binds Robinhood Chain 4663');
  assert.match(bodies.rwa_registry_lifecycle_inbox_v2,
    /UNIQUE\s*\(\s*chain_id\s*,\s*contract_address\s*,\s*block_hash\s*,\s*transaction_hash\s*,\s*log_index\s*\)/i,
    'CN-6A inbox binds the complete immutable finalized-log identity');
  assert.match(bodies.rwa_registry_activation_instances_v2,
    /PRIMARY KEY\s*\(\s*chain_id\s*,\s*registry_address\s*,\s*asset_version_key\s*,\s*activation_generation\s*\)/i,
    'CN-6A activation instances never reuse a generation');
  assert.match(bodies.rwa_registry_activation_instances_v2,
    /valid_until\s*=\s*approved_at\s*\+\s*interval\s*'604800 seconds'/i,
    'CN-6A activation instances enforce the exact seven-day package TTL');
  assert.match(bodies.rwa_registry_activation_instances_v2,
    /approved_at\s*<=\s*included_at[\s\S]*included_at\s*<\s*valid_until/i,
    'CN-6A activation instances enforce half-open timely inclusion');
  assert.match(bodies.rwa_registry_lifecycle_attempts_v2,
    /status\s+TEXT[\s\S]{0,100}?CHECK\s*\(status\s+IN\s*\(\s*'started'\s*,\s*'succeeded'\s*,\s*'failed'\s*,\s*'superseded'\s*\)\)/i,
    'CN-6A attempt history has a closed operational lifecycle');
  assert.match(bodies.rwa_registry_lifecycle_attempts_v2,
    /status\s*=\s*'started'[\s\S]*ended_at\s+IS NULL[\s\S]*status\s+IN\s*\(\s*'succeeded'\s*,\s*'failed'\s*,\s*'superseded'\s*\)[\s\S]*ended_at\s+IS NOT NULL/i,
    'CN-6A attempt completion time is coherent with terminal status');

  const requiredIndexes = [
    'ux_rwa_registry_lifecycle_inbox_identity_v2',
    'ix_rwa_registry_lifecycle_inbox_order_v2',
    'ix_rwa_registry_activation_instances_asset_generation_v2',
    'ix_rwa_registry_ballot_events_day_v2',
    'ix_rwa_registry_lifecycle_event_results_disposition_v2',
    'ix_rwa_registry_lifecycle_attempts_status_v2',
  ];
  for (const index of requiredIndexes) {
    assert.match(SCHEMA, new RegExp(`CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)? ${index}\\b`, 'i'),
      `CN-6A schema must create operational index ${index}`);
  }

  const rows = (await pool.query(
    `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'rwa_registry_%_v2'
       ORDER BY table_name`,
  )).rows.map((row) => row.table_name);
  for (const table of expectedTables) {
    assert(rows.includes(table), `fresh schema migration must materialize ${table}`);
  }
}

console.log(`✅ Schema-integrity test passed — MED-1: ${stmts.length} idempotent ADD COLUMN IF NOT EXISTS statements derived from schema.sql (no leakage, clean no-op on a fresh DB, a dropped later-added column is RE-ADDED). MED-2: all ${charTables.size} character-scoped tables (character_id OR a named %_character role) have a documented death disposition (${Object.values(DISPOSITION).filter((v) => v === 'wiped').length} wiped / ${Object.values(DISPOSITION).filter((v) => v === 'special').length} special / ${Object.values(DISPOSITION).filter((v) => v === 'escrow').length} escrow / ${Object.values(DISPOSITION).filter((v) => v === 'ledger' || v === 'log').length} ledger — a new unclassified table fails CI closed, and every wiped/special table has a DELETE or a resolving status UPDATE in src). Phase 1: ${Object.keys(PHASE1_DISPOSITION).length} world-graph tables and ${Object.keys(PHASE1_OWNER_TUPLE_DISPOSITION).length} generic owner/depositor tuple roles have explicit fail-closed no-inheritance dispositions.`);
process.exit(0);
