import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';

import { makeDb } from '../src/db.js';

const raw = process.env.DB_BOOT_TEST_ADMIN_URL;
assert(raw, 'Set DB_BOOT_TEST_ADMIN_URL to an explicit disposable PostgreSQL admin database');
const endpoint = new URL(raw);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
assert(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
assert(!endpoint.search && !endpoint.hash);
const local = endpoint.port === '35449' && endpoint.username === 'pilot_runner'
  && !endpoint.password && endpoint.pathname === '/postgres';
const ci = endpoint.port === '55442' && endpoint.username === 'postgres'
  && endpoint.password === 'pgcheck' && endpoint.pathname === '/postgres';
assert(local || ci, 'Refusing an unowned database-boot PostgreSQL target');

const database = `omerta_boot_${crypto.randomBytes(8).toString('hex')}`;
assert(/^omerta_boot_[a-f0-9]{16}$/.test(database));
const admin = new pg.Pool({ connectionString: endpoint.toString() });
const target = new URL(endpoint);
target.pathname = `/${database}`;
const original = {
  databaseUrl: process.env.DATABASE_URL,
  statementTimeout: process.env.PG_STATEMENT_TIMEOUT_MS,
  lockTimeout: process.env.PG_LOCK_TIMEOUT_MS,
};
let blocker;
const pools = [];

const restore = (name, value) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  await admin.query(`CREATE DATABASE "${database}"`);
  blocker = new pg.Client({ connectionString: target.toString() });
  await blocker.connect();
  await blocker.query('SELECT pg_advisory_lock($1)', [918273645]);

  process.env.DATABASE_URL = target.toString();
  process.env.PG_STATEMENT_TIMEOUT_MS = '15000';
  process.env.PG_LOCK_TIMEOUT_MS = '100';

  let settled = 0;
  const boot = () => makeDb().then(
    pool => { settled++; return { pool }; },
    error => { settled++; return { error }; },
  );
  const first = boot();
  const second = boot();

  let waiting = 0;
  for (let attempts = 0; attempts < 200 && waiting < 2; attempts++) {
    waiting = Number((await admin.query(
      `SELECT count(*) n FROM pg_stat_activity
        WHERE datname=$1 AND wait_event_type='Lock' AND wait_event='advisory'`,
      [database])).rows[0].n);
    if (waiting < 2) await delay(25);
  }
  assert.equal(waiting, 2, 'both independent booters reached the cross-process advisory lock');
  await delay(250);
  assert.equal(settled, 0,
    'schema boot disables the request lock timeout while waiting for the boot advisory lock');

  await blocker.query('SELECT pg_advisory_unlock($1)', [918273645]);
  const results = await Promise.all([first, second]);
  for (const result of results) {
    if (result.error) throw result.error;
    pools.push(result.pool);
  }
  const stamp = (await pools[0].query(
    'SELECT app_version,schema_sha FROM schema_meta WHERE id=1'
  )).rows[0];
  assert.equal(stamp.app_version, '1.5.1');
  assert.equal(stamp.schema_sha,
    crypto.createHash('sha256').update(fs.readFileSync(new URL('../schema.sql', import.meta.url))).digest('hex').slice(0, 16));
  assert.equal(Number((await pools[0].query(
    "SELECT count(*) n FROM pg_trigger WHERE tgname='social_claims_legacy_receipt_guard' AND NOT tgisinternal"
  )).rows[0].n), 1, 'serialized boot leaves exactly one live receipt guard');

  console.log('Native DB boot lock PASS: two booters outwait request lock_timeout and serialize complete 1.5.1 schema setup');
} finally {
  restore('DATABASE_URL', original.databaseUrl);
  restore('PG_STATEMENT_TIMEOUT_MS', original.statementTimeout);
  restore('PG_LOCK_TIMEOUT_MS', original.lockTimeout);
  for (const pool of pools) await pool.end().catch(() => {});
  if (blocker) await blocker.end().catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`).catch(() => {});
  await admin.end();
}
