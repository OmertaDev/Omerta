// Mutable caller objects must not change a command after its replay hash is reserved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { registerPgMemCompatibility, dbCaps } from '../src/db.js';
import { createItem, withItemTransaction } from '../src/items.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { createWorldKernel } from '../src/world-kernel.js';

const mem = newDb({ noAstCoverageCheck: true });
registerPgMemCompatibility(mem, DataType); dbCaps.skipLocked = false;
const { Pool } = mem.adapters.createPg(), pool = new Pool();
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const reached = deferred(), resume = deferred();
let paused = false;
const pausedPool = { async connect() {
  const client = await pool.connect();
  return { release: (...args) => client.release(...args), async query(sql, args) {
    const result = await client.query(sql, args);
    if (!paused && sql === 'SELECT crew_id FROM crew_members WHERE account_id=$1') {
      paused = true; reached.resolve(); await resume.promise;
    }
    return result;
  } };
} };
const registry = loadGraphPackages([{ id: 'input-proof', version: 1, dependsOn: [],
  nodes: [{ id: 'item:proof-key', type: 'item_template', version: 1, visibility: 'public' }] }]);
const objects = [{ id: 'object:input-proof', type: 'world_object', title: 'Proof lock', locationId: 'docks',
  states: ['closed', 'open'], initialState: 'closed', publicStates: ['closed', 'open'], knowledge: [],
  actions: [{ id: 'unlock', from: 'closed', to: 'open', itemTemplateId: 'item:proof-key', materials: [] }] }];

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('input-actor','test','input-actor')");
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('input-street','input-actor','Input Actor',1,'docks')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('input-crew','Input Crew','input-actor')");
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('input-crew','input-actor','Input Actor')");
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('input-family','Input Family','IPF')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('input-family','input-street','boss')");
  const owner = { scope: 'account', id: 'input-actor' };
  const originalItem = await withItemTransaction(pool, (client) => createItem(client, owner, 'item:proof-key', 'crafted', 'input-create-a'));
  const replacementItem = await withItemTransaction(pool, (client) => createItem(client, owner, 'item:proof-key', 'crafted', 'input-create-b'));
  const kernel = createWorldKernel({ pool: pausedPool, registry, objects, enabled: true });
  const input = { objectId: objects[0].id, actionId: 'unlock', itemId: originalItem.id, expectedRevision: 0 };
  const original = { ...input };
  const pending = kernel.execute('input-actor', input, 'input-mutable-proof');
  await reached.promise;
  input.itemId = replacementItem.id;
  input.expectedRevision = 1000;
  input.objectId = 'object:changed';
  input.actionId = 'changed';
  resume.resolve();
  const result = await pending;
  assert.equal(result.state, 'open');
  const states = (await pool.query('SELECT id,state FROM item_instances ORDER BY id')).rows;
  assert.equal(states.find((row) => row.id === originalItem.id).state, 'consumed');
  assert.equal(states.find((row) => row.id === replacementItem.id).state, 'active');
  assert.equal((await pool.query('SELECT item_id FROM world_kernel_events')).rows[0].item_id, originalItem.id);
  assert.deepEqual(await kernel.execute('input-actor', original, 'input-mutable-proof'), result);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM world_kernel_events')).rows[0].n), 1);
  console.log('world-kernel-input: command snapshot survives mutation after replay reservation');
} finally { resume.resolve(); await pool.end(); }
