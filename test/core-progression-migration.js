// Upgrade the exact populated Phase 4 prerequisite checkpoint, then reapply.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { dbCaps, migrateSchemaUnderLock } from '../src/db.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { WORLD_KERNEL_REGISTRY as registry } from '../src/content/world-kernel-pilot.js';

assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit scratch endpoint required');
const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const namespace = `progression_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
dbCaps.skipLocked = true;
const baseline = 'a18c63cc0c1eb15c7a89df99d7a1428616eb3b58';
const key = () => crypto.randomUUID();
try {
  await pool.query(execFileSync('git', ['show', `${baseline}:schema.sql`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('progression-migrant','test','progression-migrant')");
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('progression-character','progression-migrant','Progression Migrant',1,'foundry')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('progression-crew','Progression Crew','progression-migrant')");
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('progression-crew','progression-migrant','Progression Migrant')");
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('progression-family','Progression Family','PGM')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('progression-family','progression-character','boss')");
  const kernel = createWorldKernel({ pool, registry, enabled: true, objects: [{ id: 'migration:progression', type: 'facility',
    title: 'Migration archive', locationId: 'foundry', states: ['sealed', 'open'], initialState: 'sealed',
    publicStates: ['sealed', 'open'], knowledge: [], actions: [{ id: 'open', from: 'sealed', to: 'open',
      itemTemplateId: 'item:archive_turn_key', materials: [] }] }] });
  const definition = { id: 'operation:progression_migration', version: 1, title: 'Progression migration', lifetimeSeconds: 3600,
    executorRoleId: 'organizer', roles: [
      { id: 'organizer', title: 'Organizer', requirements: [{ id: 'present', kind: 'participation', quantity: 1 }] },
      { id: 'locksmith', title: 'Locksmith', requirements: [{ id: 'key', kind: 'item', templateId: 'item:archive_turn_key', quantity: 1 }] },
    ], world: { objectId: 'migration:progression', actionId: 'open', itemRoleId: 'locksmith', itemRequirementId: 'key' },
    resolution: { chancePermille: 1000, skillBonuses: [] } };
  const service = () => createFamilyOperations({ pool, registry, kernel, definitions: [definition], enabled: true });
  const beforeService = service(), createKey = key();
  const receipt = await beforeService.create('progression-migrant', { definitionId: definition.id }, createKey);
  for (const [action, input] of [['publish', {}], ['join', { roleId: 'organizer' }], ['commit', { requirementId: 'present' }]]) {
    await beforeService.command('progression-migrant', receipt.operationId, action, input, key());
  }
  const tables = ['world_operations', 'world_operation_roles', 'world_operation_commitments', 'world_operation_events', 'item_mutation_guards'];
  const capture = async () => Object.fromEntries(await Promise.all(tables.map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
  const before = await capture();
  const migrate = async () => {
    const client = await pool.connect();
    try { await client.query('SELECT pg_advisory_lock(774131)'); assert.equal((await migrateSchemaUnderLock(client)).migration.failed, 0); }
    finally { await client.query('SELECT pg_advisory_unlock(774131)'); client.release(); }
  };
  await migrate(); await migrate();
  assert.deepEqual(await capture(), before, 'Upgrade preserves existing operation pins, commitments, events and retries');
  assert.deepEqual(await service().create('progression-migrant', { definitionId: definition.id }, createKey), receipt);
  await pool.query("INSERT INTO world_recipe_usage(recipe_id,scope,subject_id,period_kind,period_key,used) VALUES('migration:recipe','global','*','lifetime','all',1)");
  await migrate();
  assert.equal((await pool.query("SELECT used FROM world_recipe_usage WHERE recipe_id='migration:recipe'")).rows[0].used, 1);
  await assert.rejects(pool.query("UPDATE world_recipe_usage SET used=-1 WHERE recipe_id='migration:recipe'"), { code: '23514' });
  await assert.rejects(pool.query("UPDATE world_recipe_usage SET subject_id='forged' WHERE recipe_id='migration:recipe'"), { code: '23514' });
  await pool.query("UPDATE world_operation_commitments SET kind='prerequisite' WHERE operation_id=$1", [receipt.operationId]);
  await assert.rejects(pool.query("UPDATE world_operation_commitments SET kind='invented' WHERE operation_id=$1", [receipt.operationId]), { code: '23514' });
  console.log(`core-progression-migration: populated ${baseline} upgrade, repeated migration, quota constraints and legacy replay pass`);
} finally {
  await pool.end(); await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end();
}
