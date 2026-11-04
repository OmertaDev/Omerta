import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { migrateDeedBenefitStorage, recordDeedBenefitEligibility, deedBenefitEligibilityAt } from '../src/deedbenefits.js';
import { enforceDatabaseRls } from '../src/db-rls.js';
import { PACING } from '../src/rules.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set a disposable COORDINATION_TEST_DATABASE_URL');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Disposable loopback PostgreSQL required');
const schema = `deed_benefits_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema}` });
const client = await pool.connect();
try {
  await client.query('CREATE TABLE characters(id TEXT PRIMARY KEY)');
  await client.query("INSERT INTO characters VALUES('benefit-life')");
  await client.query('BEGIN');
  await migrateDeedBenefitStorage(client);
  const life = { id: 'benefit-life', alive: true, respect: PACING.LEVEL_DIVISOR * 24 ** 2 };
  await recordDeedBenefitEligibility(client, life, 123000);
  assert.equal(+(await deedBenefitEligibilityAt(client, life)), 123000);
  await client.query('ROLLBACK');
  assert.equal((await client.query("SELECT to_regclass('street_deed_benefit_eligibility') present")).rows[0].present, null,
    'a failed startup rolls back the entire additive migration');
  await client.query('BEGIN');
  await migrateDeedBenefitStorage(client);
  await recordDeedBenefitEligibility(client, life, 456000);
  await client.query('COMMIT');
  await client.query('BEGIN');
  await migrateDeedBenefitStorage(client);
  await recordDeedBenefitEligibility(client, life, 789000);
  await client.query('COMMIT');
  assert.equal(+(await deedBenefitEligibilityAt(client, life)), 456000,
    'restart and repeated persistence preserve the first confirmed eligibility time');
  const rls = await enforceDatabaseRls(client);
  assert.equal(rls.verified, true);
  assert.equal(rls.tables, 2, 'the new marker and character table both pass the actual RLS/PUBLIC-revocation sweep');
  await client.query("DELETE FROM characters WHERE id='benefit-life'");
  assert.equal((await client.query('SELECT COUNT(*)::int n FROM street_deed_benefit_eligibility')).rows[0].n, 0,
    'deleting a life cannot leave an eligibility marker for a later character');
  console.log('deed-benefits-postgres: PASS (transactional migration, rollback, restart, timestamps, RLS and cascade)');
} finally {
  client.release();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
