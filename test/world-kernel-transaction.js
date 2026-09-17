// Collective world mutation composes with one caller-owned item transaction and receipt.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { bus } from '../src/game.js';
import { createItem, grantStack, consumeStack, escrowItem, withItemTransaction, withItemMutation, registerItemTransactionUndo } from '../src/items.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `world_kernel_transaction_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=5000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID(), boss = 'transaction-boss', supplier = 'transaction-supplier';
const owner = (id) => ({ scope: 'account', id });
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const requirement = { contentHash: graph.contentHash, ...graph.nodes.find(({ id }) => id === 'docks-source').claim };
const registry = loadGraphPackages([{ id: 'transaction-fixture', version: 1, dependsOn: [], nodes: [
  { id: 'item:transaction-key', type: 'item_template', version: 1, visibility: 'public' },
  { id: 'mat:transaction-metal', type: 'material', version: 1, visibility: 'public' },
] }]);
const names = ['success', 'rollback', 'wrong-kind', 'wrong-owner', 'wrong-operation', 'wrong-family', 'wrong-status', 'proof', 'item-owner'];
const objects = names.map((name) => ({ id: `object:transaction-${name}`, type: 'facility', title: 'Sealed store', locationId: 'docks',
  states: ['closed', 'open'], initialState: 'closed', publicStates: ['closed', 'open'], knowledge: [requirement],
  actions: [{ id: 'open', from: 'closed', to: 'open', itemTemplateId: 'item:transaction-key',
    materials: [{ templateId: 'mat:transaction-metal', quantity: 2 }] }] }));
const kernel = createWorldKernel({ pool, registry, objects, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const tx = (action) => withItemTransaction(pool, action);
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const notifications = [], onChange = (event) => notifications.push(event);
async function fixture(name) {
  const operationId = `transaction-operation-${name}`;
  await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,
    coordination_mode,family_id,run_key,coordination_definition_hash,coordination_definition_json,expires_at,resolution_seed,status)
    VALUES($1,'transaction-fixture',1,$2,'transaction-crew',$3,'family','transaction-family',$1,$4,'{}',$5,'fixture-seed','resolving')`,
  [operationId, `objective:${name}`, boss, 'a'.repeat(64), new Date(Date.now() + 3600_000)]);
  const item = await tx((client) => createItem(client, owner(supplier), 'item:transaction-key', 'crafted', key()));
  await tx((client) => escrowItem(client, owner(supplier), operationId, item.id, 'participant item deposit', key()));
  await tx((client) => grantStack(client, owner(boss), 'mat:transaction-metal', 2, 'standard', 'fixture source', key()));
  await tx((client) => withItemMutation(client, owner(boss), 'operation_action', key(),
    { action: 'deposit', operationId, itemAuthority: { operations: [operationId] } }, async (mutation) => {
      await consumeStack(client, owner(boss), 'mat:transaction-metal', 2, 'standard', 'participant materials deposit', mutation);
      await grantStack(client, { scope: 'operation', id: operationId }, 'mat:transaction-metal', 2, 'standard', 'participant materials deposit', mutation);
      return { operationId };
    }));
  return { operationId, input: { objectId: `object:transaction-${name}`, actionId: 'open', itemId: item.id, expectedRevision: 0 } };
}
const tables = ['world_operations', 'world_kernel_objects', 'world_kernel_events', 'item_instances', 'item_stacks',
  'operation_escrow', 'item_events', 'item_mutation_guards'];
async function snapshot() {
  return Object.fromEntries(await Promise.all(tables.map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
}
async function resolve(fixture, options = {}) {
  return tx((client) => withItemMutation(client, owner(options.rootAccount ?? boss), options.kind ?? 'operation_action', options.key ?? key(),
    { action: 'resolve', operationId: fixture.operationId, input: fixture.input,
      itemAuthority: { operations: [options.boundOperation ?? fixture.operationId] } }, async (mutation) => {
      // The coordinator owns this social prefix before its grouped claim batch.
      await client.query("SELECT id FROM crews WHERE id='transaction-crew' FOR UPDATE");
      const operation = (await client.query('SELECT id,status,resolved_at FROM world_operations WHERE id=$1 FOR UPDATE', [fixture.operationId])).rows[0];
      const actor = (await client.query('SELECT id,account_id,alive FROM characters WHERE account_id=$1 FOR UPDATE', [boss])).rows[0];
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR SHARE', [boss]);
      await client.query("SELECT id FROM gangs WHERE id='transaction-family' FOR SHARE");
      const context = await knowledge.context(client, { accountId: boss, character: actor, lock: true });
      const proof = await knowledge.prepareRequirementProof(client, [{ context, requirements: options.emptyProof ? [] : [requirement] }]);
      const world = await kernel.executeInTransaction(client, boss, fixture.input, mutation,
        { operationId: fixture.operationId, knowledgeProof: options.forgedProof ? {} : proof });
      options.onWorld?.(world);
      await reject(kernel.notifyCommitted(world), 'world_transaction_active');
      registerItemTransactionUndo(client, () => client.query('UPDATE world_operations SET status=$2,resolved_at=$3 WHERE id=$1',
        [operation.id, operation.status, operation.resolved_at]));
      await client.query("UPDATE world_operations SET status='completed',resolved_at=now() WHERE id=$1", [operation.id]);
      if (options.crash) throw Object.assign(Error('outer resolution failure'), { code: 'injected_resolution_failure' });
      return { operationId: fixture.operationId, status: 'completed', world };
    }));
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const account of [boss, supplier]) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [account, 'test']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,1,'docks')", [`${account}-ch`, account]);
  }
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('transaction-crew','Transaction Crew',$1)", [boss]);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('transaction-crew',$1,$1)", [boss]);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('transaction-family','Transaction Family','TXN')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('transaction-family',$1,'boss')", [`${boss}-ch`]);
  let instance = (await api.create(boss, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await api.act(boss, instance.id, { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  await api.act(boss, instance.id, { expectedRevision: instance.revision,
    actionId: instance.actions.find((action) => action.kind === 'discover').id }, key());
  bus.on('world:changed', onChange);
  const success = await fixture('success'), receiptKey = key();
  const beforeHints = notifications.length;
  const receipt = await resolve(success, { key: receiptKey });
  assert.equal(notifications.length, beforeHints, 'The transaction entry point never emits by itself');
  assert.equal(receipt.world.state, 'open'); assert.equal(receipt.world.revision, 1);
  assert.equal((await pool.query('SELECT status FROM world_operations WHERE id=$1', [success.operationId])).rows[0].status, 'completed');
  const event = (await pool.query('SELECT * FROM world_kernel_events WHERE id=$1', [receipt.world.eventId])).rows[0];
  assert.equal(event.operation_id, success.operationId); assert.equal(event.family_id, 'transaction-family');
  const guard = (await pool.query('SELECT mutation_kind,result_json FROM item_mutation_guards WHERE mutation_id=$1', [event.mutation_id])).rows[0];
  assert.equal(guard.mutation_kind, 'operation_action'); assert.deepEqual(JSON.parse(guard.result_json), receipt);
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [success.input.itemId])).rows[0].state, 'consumed');
  assert.equal((await pool.query('SELECT 1 FROM operation_escrow WHERE operation_id=$1', [success.operationId])).rows.length, 0);
  assert.equal(Number((await pool.query("SELECT quantity FROM item_stacks WHERE owner_scope='operation' AND owner_id=$1", [success.operationId])).rows[0]?.quantity ?? 0), 0);
  assert.equal(await kernel.notifyCommitted({ ...receipt.world }), false, 'Copied receipts cannot mint invalidations');
  assert.equal(await kernel.notifyCommitted(receipt.world), true); assert.equal(await kernel.notifyCommitted(receipt.world), false);
  assert.equal(notifications.length, beforeHints + 1);
  const after = await snapshot();
  assert.deepEqual(await resolve(success, { key: receiptKey }), receipt, 'The outer root receipt replays the committed world result');
  assert.deepEqual(await snapshot(), after);
  const rollback = await fixture('rollback'), beforeRollback = await snapshot(); let rolledBackReceipt;
  await reject(resolve(rollback, { crash: true, onWorld: (value) => { rolledBackReceipt = value; } }), 'injected_resolution_failure');
  assert.deepEqual(await snapshot(), beforeRollback, 'Outer failure restores all deposits, world state, events and receipts');
  assert.equal(await kernel.notifyCommitted(rolledBackReceipt), false, 'A rolled-back event cannot emit a hint');
  for (const [name, options, code] of [
    ['wrong-kind', { kind: 'world_action' }, 'world_forbidden'],
    ['wrong-owner', { rootAccount: supplier }, 'world_forbidden'],
    ['wrong-operation', { boundOperation: success.operationId }, 'item_mutation_authority'],
    ['proof', { forgedProof: true }, 'bad_knowledge_proof'],
  ]) {
    const run = await fixture(name), before = await snapshot();
    await reject(resolve(run, options), code); assert.deepEqual(await snapshot(), before);
    if (name === 'proof') { await reject(resolve(run, { emptyProof: true }), 'world_unavailable'); assert.deepEqual(await snapshot(), before); }
  }
  for (const [name, column, value] of [['wrong-family', 'family_id', 'other-family'], ['wrong-status', 'status', 'ready']]) {
    const run = await fixture(name);
    await pool.query(`UPDATE world_operations SET ${column}=$2 WHERE id=$1`, [run.operationId, value]);
    const before = await snapshot(); await reject(resolve(run), 'world_forbidden'); assert.deepEqual(await snapshot(), before);
  }
  const wrongItem = await fixture('item-owner');
  const accountItem = await tx((client) => createItem(client, owner(boss), 'item:transaction-key', 'crafted', key()));
  const beforeWrongItem = await snapshot();
  await reject(resolve({ ...wrongItem, input: { ...wrongItem.input, itemId: accountItem.id } }), 'world_unavailable');
  assert.deepEqual(await snapshot(), beforeWrongItem, 'Collective execution cannot substitute an account-owned item for escrow');
  assert.equal(notifications.length, beforeHints + 1);
  console.log(`world-kernel-transaction: caller-owned atomicity, multi-owner escrow, proof/operation authority, replay and postcommit hints passed (${postgres ? 'PostgreSQL' : 'pg-mem'})`);
} finally { bus.off('world:changed', onChange); await cleanup(); }
