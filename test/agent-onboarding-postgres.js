// Explicit disposable PostgreSQL only; no project credentials or DATABASE_URL fallback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import * as auth from '../src/auth.js';

assert(process.env.AGENT_ONBOARDING_TEST_DATABASE_URL, 'Explicit AGENT_ONBOARDING_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.AGENT_ONBOARDING_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
assert(endpoint.port && endpoint.port !== '5432');
assert.equal(endpoint.pathname, '/omerta_agent_review');
const namespace = 'agent_onboarding_' + crypto.randomBytes(8).toString('hex');
const admin = new Pool({ connectionString: endpoint.href, max: 2 });
const pool = new Pool({ connectionString: endpoint.href, max: 6,
  options: `-c search_path=${namespace} -c lock_timeout=10000 -c statement_timeout=10000` });
const singlePool = new Pool({ connectionString: endpoint.href, max: 1, connectionTimeoutMillis: 1000,
  options: `-c search_path=${namespace} -c lock_timeout=10000 -c statement_timeout=10000` });
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const randomSecret = () => crypto.randomBytes(32).toString('base64url');
try {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  for (const name of ['accounts', 'account_persistent']) {
    const ddl = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\([\\s\\S]*?\\n\\);`))?.[0];
    assert(ddl, name);
    await pool.query(ddl);
  }
  await pool.query(schema.split('\n').filter(line => /^ALTER TABLE (accounts|account_persistent) ADD COLUMN IF NOT EXISTS /.test(line)).join('\n'));
  await pool.query('CREATE UNIQUE INDEX ux_accounts_guest_bootstrap_hash ON accounts (guest_bootstrap_hash)');
  await pool.query('CREATE TABLE characters (id UUID PRIMARY KEY, account_id UUID NOT NULL)');

  // Independent module instances have independent process-local recovery queues.
  // Hold both missing-row lookups until both contenders have observed no mapping.
  const other = await import('../src/auth.js?agent-onboarding-pg-race');
  let arrived = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const racingPool = {
    async connect() {
      const client = await pool.connect();
      return {
        async query(text, args) {
          const result = await client.query(text, args);
          if (typeof text === 'string' && text.includes('WHERE guest_bootstrap_hash=$1 FOR UPDATE') && result.rows.length === 0 && arrived < 2) {
            if (++arrived === 2) release();
            await barrier;
          }
          return result;
        },
        release: () => client.release(),
      };
    },
  };
  const secret = randomSecret();
  const results = await Promise.all([
    auth.accountForAgentBootstrap(racingPool, secret, '127.0.0.1'),
    other.accountForAgentBootstrap(racingPool, secret, '127.0.0.1'),
  ]);
  assert.equal(arrived, 2, 'both independent contenders observed the missing mapping');
  assert.equal(results[0].accountId, results[1].accountId, 'unique-index loser recovers the committed winner');
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n), 1);
  const accountId = results[0].accountId;
  assert.equal((await pool.query('SELECT agent_flag FROM account_persistent WHERE account_id=$1', [accountId])).rows[0].agent_flag, true);
  await auth.acknowledgeGuestBootstrap(pool, accountId);
  await assert.rejects(other.accountForAgentBootstrap(pool, secret, '127.0.0.1'), e => e.code === 'bootstrap_retired');
  console.log('PASS independent recovery queues race to one permanently flagged PostgreSQL identity; acknowledgement retires proof');

  const failedSecret = randomSecret();
  const failingPool = {
    async connect() {
      const client = await singlePool.connect();
      return {
        query: (text, args) => text.startsWith('INSERT INTO account_persistent')
          ? Promise.reject(new Error('injected classification write failure')) : client.query(text, args),
        release: () => client.release(),
      };
    },
  };
  await assert.rejects(auth.accountForAgentBootstrap(failingPool, failedSecret, '127.0.0.1'), /injected classification/);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n), 1,
    'a failed permanent classification leaves no unflagged account behind');
  const retried = await auth.accountForAgentBootstrap(pool, failedSecret, '127.0.0.1');
  await pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [retried.accountId]);
  await assert.rejects(auth.accountForAgentBootstrap(pool, failedSecret, '127.0.0.1'), e => e.code === 'bootstrap_retired');
  console.log('PASS classification failure rolls back admission; same proof can retry; token revocation prevents recovery');
} finally {
  await singlePool.end();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
  await admin.end();
}
