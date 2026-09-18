// Upgrade exact main, populated through existing world/knowledge/item/operation
// services. Reapplying migration must preserve both that history and Director state.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { dbCaps, migrateSchemaUnderLock } from '../src/db.js';
import { withCharacter, travel } from '../src/game.js';
import { boostCar } from '../src/economy.js';
import { createCrew } from '../src/crew.js';
import { createGang } from '../src/social.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { createDockWarContent, DOCK_WAR_IDS as ids } from '../src/content/dock-war.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { addPlayer, issueAndExecute } from './lib/player-command-support.js';

const BASELINE = '44f48a743e549591bd125a1f678099b8382dd78f';
const address = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
assert(address, 'An explicit isolated PostgreSQL database URL is required');
const endpoint = new URL(address);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const namespace = `director_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
let pool, created = false;
const inventory = JSON.parse(fs.readFileSync(new URL('./lib/phase2-architecture-upgrade-catalog.json', import.meta.url), 'utf8'));
const directorTables = Object.keys(inventory.notNullColumns).filter((name) => name.startsWith('director_')).sort();
assert.equal(directorTables.length, 7);
try {
  await admin.query(`CREATE SCHEMA ${namespace}`); created = true;
  pool = new pg.Pool({ connectionString: endpoint.toString(),
    options: `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=30000` });
  assert.equal((await pool.query('SELECT current_schema() AS namespace')).rows[0].namespace, namespace);
  const serverVersion = Number((await pool.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
  dbCaps.skipLocked = true;
  await pool.query(execFileSync('git', ['show', `${BASELINE}:schema.sql`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  assert.equal((await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name LIKE 'director_%'")).rows.length, 0);
  const account = 'director-migration-owner';
  await addPlayer(pool, account); await addPlayer(pool, 'director-migration-neighbor');
  const social = (work) => withCharacter(pool, account, work);
  await social((ch, client, h) => createCrew(ch, 'Migration Dock Crew', client, h));
  await social((ch, client, h) => createGang(ch, 'Migration Dock Family', 'DMIG', client, h));
  const content = createDockWarContent();
  const engine = (director = null) => createPlayerCommandEngine({ pool, content, director,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  let commands = engine();
  const act = (type, parameters = {}) => issueAndExecute(commands, account, type, parameters);
  await act('discovery.start', { graphId: ids.coordination });
  for (let count = 0; count < 24; count++) {
    const run = (await commands.snapshot(account)).discovery.instances[0];
    const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
    if (!action) break;
    await act('discovery.act', { instanceId: run.id, actionId: action.id });
    assert(count < 23, 'Discovery must finish inside its authored bound');
  }
  await social((ch, client, h) => travel(ch, 'foundry', client, h));
  const random = Math.random; let acquired;
  try { Math.random = () => 0.01; acquired = await social((ch, client, h) => boostCar(ch, client, h)); }
  finally { Math.random = random; }
  assert.equal(acquired.car.model, 'junker');
  await act('item.salvage', { carId: acquired.car.id });
  await act('recipe.craft', { recipeId: ids.recipe });
  await social((ch, client, h) => travel(ch, 'docks', client, h));
  await act('world.execute', { objectId: ids.object, actionId: 'establish_route' });
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const family = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
  const createKey = crypto.randomUUID();
  const operation = await family.create(account, { definitionId: ids.protectOperation }, createKey);
  for (const [action, input] of [['publish', {}], ['join', { roleId: 'organizer' }], ['commit', { requirementId: 'presence' }]])
    await family.command(account, operation.operationId, action, input, crypto.randomUUID());
  const canonicalTables = ['world_kernel_objects', 'world_kernel_events', 'item_instances', 'item_stacks', 'item_events',
    'item_mutation_guards', 'coordination_instances', 'coordination_claims', 'coordination_commands', 'world_operations',
    'world_operation_roles', 'world_operation_commitments', 'world_operation_events', 'player_command_boards'];
  const capture = async (tables) => Object.fromEntries(await Promise.all(tables.map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
  const constraints = async () => (await pool.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,
    pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND c.contype<>'n'
    ORDER BY t.relname,c.conname`)).rows;
  const oldRows = await capture(canonicalTables), oldConstraints = await constraints();
  for (const table of canonicalTables) assert(oldRows[table].length > 0, `${table} must be populated before migration`);
  const migrate = async () => {
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(774139)');
      assert.equal((await migrateSchemaUnderLock(client)).migration.failed, 0);
    } finally { await client.query('SELECT pg_advisory_unlock(774139)'); client.release(); }
  };
  await migrate();
  assert.deepEqual(await capture(canonicalTables), oldRows, 'Migration preserves all existing canonical rows and receipts');
  const upgradedConstraints = await constraints();
  assert.deepEqual(upgradedConstraints.filter((row) => !row.table_name.startsWith('director_')), oldConstraints,
    'Director migration may not remove or alter any reviewed existing constraint');
  assert.deepEqual(upgradedConstraints.filter((row) => row.table_name.startsWith('director_')),
    inventory.added.filter((row) => row.table_name.startsWith('director_')),
    'Native Director constraints match the explicitly reviewed architecture inventory');
  const notNull = (await pool.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name LIKE 'director_%' AND is_nullable='NO' ORDER BY table_name,column_name`)).rows;
  assert.deepEqual(Object.fromEntries(directorTables.map((table) => [table, notNull.filter((row) => row.table_name === table).map((row) => row.column_name)])),
    Object.fromEntries(directorTables.map((table) => [table, inventory.notNullColumns[table]])));
  assert.deepEqual(await family.create(account, { definitionId: ids.protectOperation }, createKey), operation,
    'Pre-upgrade Family execution identity still reconciles after migration');

  // This assertion is about migration/replay, not the wall clock crossing the
  // scheduler's five-minute bucket while two real migrations run.
  const observedAt = Date.now();
  const director = createLivingWorldDirector({ pool, content, definitions: createDockWarDefinitions(content), mode: 'LIVE', clock: () => observedAt });
  const tick = await director.tick(); assert.equal(tick.selected.length, 1);
  commands = engine(director);
  await act('situation.act', { actionId: 'protect' });
  const currentRows = await capture([...canonicalTables, ...directorTables]);
  for (const table of directorTables) assert(currentRows[table].length > 0, `${table} must be populated before reapplication`);
  await migrate();
  assert.deepEqual(await capture([...canonicalTables, ...directorTables]), currentRows,
    'Second migration preserves populated Director definitions, campaigns, lifecycle, selections, intents and domain receipts');
  assert.deepEqual(await constraints(), upgradedConstraints);
  assert.equal((await director.tick()).replayed, true);
  await assert.rejects(pool.query('UPDATE director_situations SET revision=0 WHERE id=$1', [tick.selected[0].situationId]), { code: '23514' });
  await assert.rejects(pool.query("UPDATE director_situations SET campaign_id='missing-campaign' WHERE id=$1", [tick.selected[0].situationId]), { code: '23503' });
  await assert.rejects(pool.query('INSERT INTO director_receipts SELECT * FROM director_receipts LIMIT 1'), { code: '23505' });
  console.log(`director-migration: populated ${BASELINE}, two production migrations, canonical/Director receipt preservation and exact 17-constraint catalog PASS (PostgreSQL ${serverVersion})`);
} finally {
  if (pool) await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
