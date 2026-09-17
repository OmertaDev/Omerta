// Upgrade a populated pre-kernel release, then reapply current migrations.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { dbCaps, migrateSchemaUnderLock } from '../src/db.js';
import { createItem, withItemTransaction } from '../src/items.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';

assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit WORLD_KERNEL_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const namespace = `world_kernel_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), max: 4,
  options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=30000` });
dbCaps.skipLocked = true;
const oldRevision = 'e56cf576065c5f1bbb9bb55115f5961267f7d654';
const key = () => crypto.randomUUID();
try {
  const oldSchema = execFileSync('git', ['show', `${oldRevision}:schema.sql`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  await pool.query(oldSchema);
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('migration-player','test','migration-player')");
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('migration-character','migration-player','Migration Player',1,'foundry')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('migration-crew','Migration Crew','migration-player')");
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('migration-crew','migration-player','Migration Player')");
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('migration-family','Migration Family','MIG')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('migration-family','migration-character','boss')");
  const item = await withItemTransaction(pool, (client) => createItem(client, { scope: 'account', id: 'migration-player' },
    'item:precision_lock_tool', 'crafted', key()));
  const before = (await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows;
  const migrate = async () => {
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(774131)');
      const result = await migrateSchemaUnderLock(client);
      assert.equal(result.migration.failed, 0);
    } finally { await client.query('SELECT pg_advisory_unlock(774131)'); client.release(); }
  };
  await migrate(); await migrate();
  assert.deepEqual((await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows, before);
  const registry = loadAndValidateGraphPackages(PHASE1_WORLD_GRAPH_PACKAGES);
  const world = createWorldKernel({ pool, registry, enabled: true, objects: [{
    id: 'migration-object', type: 'world_object', title: 'Migration Object', locationId: 'foundry',
    states: ['sealed', 'open'], initialState: 'sealed', publicStates: ['sealed', 'open'], knowledge: [],
    actions: [{ id: 'open', from: 'sealed', to: 'open', itemTemplateId: 'item:precision_lock_tool', materials: [] }],
  }] });
  const request = { objectId: 'migration-object', actionId: 'open', itemId: item.id, expectedRevision: 0 }, commandKey = key();
  const receipt = await world.execute('migration-player', request, commandKey);
  assert.equal(receipt.revision, 1);
  assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
  await migrate();
  assert.deepEqual(await world.execute('migration-player', request, commandKey), receipt);
  await assert.rejects(pool.query("UPDATE world_kernel_objects SET revision=-1 WHERE id='migration-object'"), (e) => e.code === '23514');
  await assert.rejects(pool.query("UPDATE world_kernel_objects SET controller_family_id='missing' WHERE id='migration-object'"), (e) => e.code === '23503');
  await pool.query("UPDATE world_kernel_objects SET state='tampered' WHERE id='migration-object'");
  assert.equal((await worldKernelInvariants(pool)).ok, false, 'Current state must reconcile with its immutable transition');
  await pool.query("UPDATE world_kernel_objects SET state='open' WHERE id='migration-object'");
  await pool.query("DELETE FROM gang_members WHERE gang_id='migration-family'");
  await pool.query("DELETE FROM gangs WHERE id='migration-family'");
  assert.equal((await world.get('migration-player', 'migration-object')).controllerFamilyId, null);
  assert.equal((await pool.query('SELECT family_id FROM world_kernel_events')).rows[0].family_id, 'migration-family');
  assert.equal((await worldKernelInvariants(pool)).ok, true);
  console.log(`PASS PostgreSQL kernel migration from ${oldRevision}: preserved provenance, repeated boot, durable replay, constraints, dissolution, invariant corruption detection`);
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
