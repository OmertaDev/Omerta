import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { dbCaps, migrateSchemaUnderLock } from '../src/db.js';
import { createItem, escrowItem, withItemTransaction } from '../src/items.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { WORLD_KERNEL_REGISTRY as registry } from '../src/content/world-kernel-pilot.js';
assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL allowed');
const namespace = `family_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), max: 4,
  options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=30000` });
dbCaps.skipLocked = true;
const baseline = '72235ae5';
const key = () => crypto.randomUUID();
const definitionId = 'operation:migration';
try {
  await pool.query(execFileSync('git', ['show', `${baseline}:schema.sql`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('migration-account','test','migration-account')");
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('migration-character','migration-account','Family Migration',1,'foundry')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('migration-crew','Migration Crew','migration-account')");
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('migration-crew','migration-account','Family Migration')");
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('migration-family','Migration Family','MIG')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('migration-family','migration-character','boss')");
  await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
    VALUES('legacy-operation',$1,1,$1,'migration-crew','migration-account')`, [definitionId]);
  const item = await withItemTransaction(pool, (client) => createItem(client, { scope: 'account', id: 'migration-account' },
    'item:precision_lock_tool', 'crafted', key()));
  await withItemTransaction(pool, (client) => escrowItem(client, { scope: 'account', id: 'migration-account' },
    'legacy-operation', item.id, 'legacy migration escrow', key(), 'used_in_operation'));
  const provenance = (await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows;
  const migrate = async () => {
    const client = await pool.connect();
    try { await client.query('SELECT pg_advisory_lock(774131)'); assert.equal((await migrateSchemaUnderLock(client)).migration.failed, 0); }
    finally { await client.query('SELECT pg_advisory_unlock(774131)'); client.release(); }
  };
  await migrate(); await migrate();
  const legacy = (await pool.query("SELECT * FROM world_operations WHERE id='legacy-operation'")).rows[0];
  assert.equal(legacy.coordination_mode, 'crew'); assert.equal(legacy.run_key, '');
  assert.equal((await pool.query('SELECT operation_id FROM operation_escrow WHERE item_id=$1', [item.id])).rows[0].operation_id, legacy.id);
  assert.deepEqual((await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows, provenance);
  await assert.rejects(pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
    VALUES('legacy-duplicate',$1,1,$1,'migration-crew','migration-account')`, [definitionId]), (e) => e.code === '23505');
  const kernel = createWorldKernel({ pool, registry, enabled: true, objects: [{ id: 'migration-object', type: 'world_object',
    title: 'Migration objective', locationId: 'foundry', states: ['closed', 'open'], initialState: 'closed',
    publicStates: ['closed', 'open'], knowledge: [], actions: [{ id: 'open', from: 'closed', to: 'open',
      itemTemplateId: 'item:precision_lock_tool', materials: [] }] }] });
  const definitions = [{ id: definitionId, version: 1, title: 'Migration operation', lifetimeSeconds: 3600,
    executorRoleId: 'organizer', roles: [
      { id: 'organizer', title: 'Organizer', requirements: [{ id: 'presence', kind: 'participation', quantity: 1 }] },
      { id: 'specialist', title: 'Specialist', requirements: [{ id: 'key', kind: 'item', quantity: 1, templateId: 'item:precision_lock_tool' }] }],
    world: { objectId: 'migration-object', actionId: 'open', itemRoleId: 'specialist', itemRequirementId: 'key' },
    resolution: { chancePermille: 1000, skillBonuses: [] } }];
  const service = () => createFamilyOperations({ pool, registry, kernel, definitions, enabled: true });
  const commandKey = key(), created = await service().create('migration-account', { definitionId }, commandKey);
  const second = await service().create('migration-account', { definitionId }, key());
  assert.notEqual(created.operationId, second.operationId);
  await migrate();
  assert.deepEqual(await service().create('migration-account', { definitionId }, commandKey), created);
  assert.equal((await familyOperationInvariants(pool)).ok, true);
  for (const update of ["status='forming'", "coordination_definition_hash=NULL", "coordination_definition_hash='short'",
    "coordination_mode='crew'", "status='completed'"])
    await assert.rejects(pool.query(`UPDATE world_operations SET ${update} WHERE id=$1`, [created.operationId]), (e) => e.code === '23514');
  await pool.query('UPDATE world_operations SET revision=99 WHERE id=$1', [created.operationId]);
  assert.equal((await familyOperationInvariants(pool)).ok, false);
  console.log('family-operation-migration: populated Phase1 upgrade, repeated boot, legacy escrow/identity, Family runs/replay, constraints and corruption detection passed');
} finally {
  await pool.end(); await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end();
}
