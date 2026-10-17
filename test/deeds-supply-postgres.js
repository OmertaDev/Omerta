import { deedBuildingById } from '../src/deedbuildings.js';
import { deedInvestigationRoute } from '../src/deeddiscovery.js';
// Real PostgreSQL evidence for the shared lifetime-issuance lock. Uses a disposable local schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { claimDeed, MAX_DEED_IDENTITIES } from '../src/deeds.js';
import { DEED_BUILDINGS } from '../src/deedbuildings.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set a disposable COORDINATION_TEST_DATABASE_URL');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Isolated loopback PostgreSQL required');
const schema = `deed_supply_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema}` });
const first = await pool.connect(), second = await pool.connect();
const definition = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = definition.match(/CREATE TABLE IF NOT EXISTS street_deed_supply \([\s\S]*?SELECT 1, COUNT\(\*\) FROM street_deeds ON CONFLICT \(id\) DO NOTHING;/)?.[0];
assert(migration, 'test exercises the actual boot migration');
const finalBuilding = DEED_BUILDINGS.at(-1);
const player = account_id => ({ id: account_id, account_id, name: account_id, alive: true,
  is_npc: false, loc: finalBuilding.district, respect: 1e8, energy: 100 });
const street = name => ({ name, district: finalBuilding.district, buildingId: finalBuilding.id });
try {
  await first.query(`CREATE TABLE street_deeds (
    account_id TEXT PRIMARY KEY, name TEXT NOT NULL, name_lc TEXT UNIQUE NOT NULL,
    district TEXT NOT NULL, corner_at TIMESTAMPTZ, onchain_token_id TEXT,
    building_id TEXT UNIQUE, extracted_by_account TEXT, home_authority_token TEXT, claimed_at TIMESTAMPTZ DEFAULT now()
  ); CREATE TABLE street_deed_history (
    account_id TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL, at TIMESTAMPTZ DEFAULT now()
  )`);
  const buildingMigration = definition.match(/CREATE TABLE IF NOT EXISTS street_deed_building_assignments \([\s\S]*?\);/)?.[0];
  assert(buildingMigration, 'test exercises the durable property-assignment migration');
  await first.query(buildingMigration);
  await first.query(`INSERT INTO street_deeds(account_id,name,name_lc,district,onchain_token_id)
    SELECT CASE WHEN i=1 THEN 'onchain:1' ELSE 'legacy-' || i END,
      'Legacy Street ' || i, 'legacy street ' || i, district, CASE WHEN i=1 THEN '1' ELSE NULL END
    FROM unnest($1::int[],$2::text[]) AS seeded(i,district)`,
  [DEED_BUILDINGS.slice(0, -1).map((_, index) => index + 1), DEED_BUILDINGS.slice(0, -1).map((building) => building.district)]);
  await first.query(migration);
  assert.equal((await first.query('SELECT issued FROM street_deed_supply')).rows[0].issued, 2499,
    'legacy migration includes extracted identities');
  await first.query(`CREATE TABLE characters (id TEXT PRIMARY KEY,account_id TEXT,alive BOOLEAN,is_npc BOOLEAN);
    CREATE TABLE account_persistent (account_id TEXT PRIMARY KEY)`);
  const discoveryMigration = definition.match(/-- Deed discovery issuance\.[\s\S]*?-- End deed discovery issuance\./)?.[0];
  assert(discoveryMigration, 'the earned distribution migration is exercised');
  await first.query(discoveryMigration);
  for (const account of ['aborted-holder','last-holder','late-holder']) {
    await first.query('INSERT INTO characters VALUES ($1,$1,true,false)', [account]);
    await first.query('INSERT INTO account_persistent VALUES ($1)', [account]);
    const evidence=deedInvestigationRoute(finalBuilding).map(step=>({buildingId:finalBuilding.id,policyVersion:2,objectiveId:step.id,actionId:step.actionId,district:step.requiredDistrict,characterId:account,at:new Date().toISOString()}));
    await first.query(`INSERT INTO street_deed_discoveries
      (account_id,building_id,steps,qualified_at,policy_version,objective_evidence) VALUES ($1,$2,4,now(),2,$3)`,[account,finalBuilding.id,JSON.stringify(evidence)]);
  }

  await first.query('BEGIN');
  await claimDeed(player('aborted-holder'), street('Aborted Street'), first);
  await first.query('ROLLBACK');
  assert.equal((await pool.query('SELECT issued FROM street_deed_supply')).rows[0].issued, 2499,
    'a rolled-back claim restores its issuance slot');
  assert.equal((await pool.query("SELECT 1 FROM street_deeds WHERE name='Aborted Street'")).rowCount, 0);
  assert.equal((await pool.query("SELECT 1 FROM street_deed_primary_claims WHERE account_id='aborted-holder'")).rowCount, 0,
    'rollback restores the account primary reward too');

  await first.query('BEGIN');
  await second.query('BEGIN');
  await claimDeed(player('last-holder'), street('Final Street'), first);
  const secondPid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const competing = claimDeed(player('late-holder'), street('Excess Street'), second)
    .then(() => null, error => error);
  let blocked = false;
  for (let attempt = 0; attempt < 100; ++attempt) {
    blocked = (await admin.query("SELECT wait_event_type='Lock' blocked FROM pg_stat_activity WHERE pid=$1", [secondPid])).rows[0]?.blocked;
    if (blocked) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(blocked, 'second account waits on the shared issuance row lock');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM street_deeds')).rows[0].n, 2499,
    'the final street is invisible until committed');
  await first.query('COMMIT');
  const rejected = await competing;
  assert.equal(rejected?.code, 'deed_supply_exhausted', 'concurrent claimant observes committed exhaustion');
  await second.query('ROLLBACK');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM street_deeds')).rows[0].n, 2500);
  assert.equal((await pool.query('SELECT issued FROM street_deed_supply')).rows[0].issued, 2500);
  await first.query(migration);
  assert.equal((await first.query('SELECT issued FROM street_deed_supply')).rows[0].issued, 2500,
    'idempotent boot does not reset lifetime issuance');
  console.log('deeds-supply-postgres: PASS (legacy extracted supply, rollback, final-slot serialization, boot replay)');
} finally {
  await first.query('ROLLBACK').catch(() => {});
  await second.query('ROLLBACK').catch(() => {});
  first.release(); second.release();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
