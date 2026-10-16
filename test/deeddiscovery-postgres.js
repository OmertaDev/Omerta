import { deedBuildingById } from '../src/deedbuildings.js';
// Real PostgreSQL proofs for earned primary issuance. Only disposable loopback schemas are used.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { claimDeed } from '../src/deeds.js';
import { investigateDeed, discoveryBoard, deedInvestigationRoute } from '../src/deeddiscovery.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set a disposable COORDINATION_TEST_DATABASE_URL');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname), 'Disposable loopback PostgreSQL required');
const schema = `deed_discovery_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema}` });
const first = await pool.connect(), second = await pool.connect();
const definition = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const discoveryMigration = definition.match(/-- Deed discovery issuance\.[\s\S]*?-- End deed discovery issuance\./)?.[0];
assert(discoveryMigration);
const actor = (id, account = id) => ({ id, account_id: account, name: id, alive: true,
  is_npc: false, loc: 'cathedral', respect: 1e8, energy: 100 });
const target = 'cathedral-0001';
const street = (name, buildingId = target) => ({ name, buildingId });
const transaction = async (fn) => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
async function addActor(ch) {
  await pool.query('INSERT INTO characters VALUES ($1,$2,true,false)', [ch.id, ch.account_id]);
  await pool.query('INSERT INTO account_persistent VALUES ($1) ON CONFLICT DO NOTHING', [ch.account_id]);
}
async function qualify(accountId, buildingId = target) {
  const evidence=deedInvestigationRoute(deedBuildingById(buildingId)).map(step=>({buildingId,policyVersion:2,objectiveId:step.id,actionId:step.actionId,district:step.requiredDistrict,characterId:accountId,at:new Date().toISOString()}));
  await pool.query(`INSERT INTO street_deed_discoveries
    (account_id,building_id,steps,qualified_at,policy_version,objective_evidence) VALUES ($1,$2,4,now(),2,$3)`, [accountId,buildingId,JSON.stringify(evidence)]);
}
try {
  await first.query(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,alive BOOLEAN,is_npc BOOLEAN);
    CREATE TABLE account_persistent(account_id TEXT PRIMARY KEY);
    CREATE TABLE street_deeds(account_id TEXT PRIMARY KEY,name TEXT NOT NULL,name_lc TEXT UNIQUE,
      district TEXT,building_id TEXT UNIQUE,onchain_token_id TEXT,extracted_by_account TEXT,
      corner_at TIMESTAMPTZ,home_authority_token TEXT,claimed_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE street_deed_history(account_id TEXT,kind TEXT,detail TEXT,at TIMESTAMPTZ DEFAULT now());`);
  for (const table of ['street_deed_building_assignments', 'street_deed_supply', 'mystery_instances', 'mystery_node_state']) {
    const ddl = definition.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert(ddl, `actual ${table} DDL is retained`);
    await first.query(ddl);
  }
  await first.query("INSERT INTO street_deed_supply VALUES (1,2)");
  await first.query(`INSERT INTO street_deeds(account_id,name,name_lc,district,extracted_by_account)
    VALUES ('legacy','Legacy House','legacy house','docks',NULL),
      ('onchain:123','Extracted House','extracted house','docks','extractor');
    INSERT INTO street_deed_history(account_id,kind,detail) VALUES ('historical','claim','legacy proof');`);
  await first.query(discoveryMigration);
  for (const account of ['legacy', 'extractor', 'historical'])
    assert.equal((await pool.query('SELECT 1 FROM street_deed_primary_claims WHERE account_id=$1', [account])).rowCount, 1);
  await first.query(`INSERT INTO street_deeds(account_id,name,name_lc,district)
    VALUES ('secondary','Secondary House','secondary house','docks')`);
  await first.query(discoveryMigration);
  assert.equal((await pool.query("SELECT 1 FROM street_deed_primary_claims WHERE account_id='secondary'")).rowCount, 0,
    'boot replay does not consume a later secondary buyer primary reward');

  const a = actor('finder-a'), b = actor('finder-b'), dead = actor('dying');
  for (const ch of [a, b, dead]) await addActor(ch);
  await assert.rejects(transaction(client => claimDeed(a, street('Unqualified House'), client)), { code: 'deed_not_discovered' });
  await assert.rejects(transaction(client => investigateDeed(a, { buildingId:'neon-0001',actionId:'inspect-site' }, client)), {code:'location'});
  // Legacy three-click completion cannot authorize a title under the new route.
  await pool.query(`INSERT INTO street_deed_discoveries(account_id,building_id,steps,qualified_at) VALUES ($1,$2,3,now())`,[a.account_id,target]);
  await assert.rejects(transaction(client=>claimDeed(a,street('Legacy Bypass'),client)),{code:'deed_not_discovered'});
  let result;
  const route=deedInvestigationRoute(deedBuildingById(target));
  for (const [index,objective] of route.entries()) {
    a.loc=objective.requiredDistrict;
    await assert.rejects(transaction(client=>investigateDeed(a,{buildingId:target,actionId:'skip-title'},client)),{code:'deed_action'});
    const beforeEnergy=a.energy;
    result=await transaction(client=>investigateDeed(a,{buildingId:target,actionId:objective.actionId},client));
    assert.equal(result.steps,index+1);
    assert.equal(a.energy,beforeEnergy-5);
    if(index<route.length-1)await assert.rejects(transaction(client=>investigateDeed(a,{buildingId:target,actionId:objective.actionId},client)),{code:'deed_action'});
  }
  assert(result.qualified);
  assert.equal(a.energy,80);
  const beforeRead = (await pool.query('SELECT COUNT(*)::int n FROM street_deed_discoveries')).rows[0].n;
  const readOnly = { query: (sql, values) => {
    assert(/^\s*SELECT\b/i.test(sql) && !/FOR\s+(UPDATE|SHARE)/i.test(sql), 'discovery boards are genuinely read-only');
    return pool.query(sql, values);
  } };
  assert((await discoveryBoard(readOnly, a)).buildings.find(row => row.id === target).canClaim);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM street_deed_discoveries')).rows[0].n, beforeRead);

  await qualify(b.account_id);
  await first.query('BEGIN');
  await second.query('BEGIN');
  await claimDeed(a, street('Won House'), first);
  const pid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const competing = claimDeed(b, street('Lost House'), second).then(() => null, error => error);
  let waiting = false;
  for (let i = 0; i < 100; ++i) {
    waiting = (await admin.query("SELECT wait_event_type='Lock' AS blocked FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0]?.blocked;
    if (waiting) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(waiting, 'two earned claims for one building serialize on the global issuance lock');
  await first.query('COMMIT');
  assert.equal((await competing)?.code, 'deed_building_claimed');
  await second.query('ROLLBACK');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM street_deed_building_assignments WHERE building_id=$1', [target])).rows[0].n, 1);
  assert.equal((await pool.query('SELECT 1 FROM street_deed_primary_claims WHERE account_id=$1', [b.account_id])).rowCount, 0,
    'the losing claimant retains its primary reward');

  await pool.query("UPDATE street_deeds SET account_id='onchain:999' WHERE account_id=$1", [a.account_id]);
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [a.id]);
  const heir = actor('finder-a-heir', a.account_id);
  await addActor(heir);
  await qualify(a.account_id, 'cathedral-0002');
  await assert.rejects(transaction(client => claimDeed(heir, street('Farm House', 'cathedral-0002'), client)), { code: 'deed_primary_claimed' });
  assert.equal((await pool.query('SELECT 1 FROM street_deed_building_assignments WHERE building_id=$1', ['cathedral-0002'])).rowCount, 0);

  await qualify(dead.account_id, 'cathedral-0003');
  await first.query('BEGIN');
  await first.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE', [dead.id]);
  await first.query('UPDATE characters SET alive=false WHERE id=$1', [dead.id]);
  await second.query('BEGIN');
  const deathPid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const afterDeath = claimDeed(dead, street('Dead House', 'cathedral-0003'), second).then(() => null, error => error);
  waiting = false;
  for (let i = 0; i < 100; ++i) {
    waiting = (await admin.query("SELECT wait_event_type='Lock' AS blocked FROM pg_stat_activity WHERE pid=$1", [deathPid])).rows[0]?.blocked;
    if (waiting) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(waiting, 'claim and death share the living character lock');
  await first.query('COMMIT');
  assert.equal((await afterDeath)?.code, 'no_character');
  await second.query('ROLLBACK');
  assert.equal((await pool.query('SELECT 1 FROM street_deed_primary_claims WHERE account_id=$1', [dead.account_id])).rowCount, 0);
  console.log('deeddiscovery-postgres: PASS (actual migrations, ordered multi-district evidence/energy, pure reads, building race, lifetime heir guard, death serialization)');
} finally {
  await first.query('ROLLBACK').catch(() => {});
  await second.query('ROLLBACK').catch(() => {});
  first.release(); second.release();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
