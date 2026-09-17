// Family coordination must not enter the legacy Crew read, mutation, or replay paths.
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { makeDb } from '../src/db.js';
import { createItem, escrowItem, withItemMutation, withItemTransaction } from '../src/items.js';
import {
  assignRole, cancelOperation, completeOperation, contribute, createOperationContext,
  openOperation, operationBoard, operationDefinitions, roleBoard,
} from '../src/operations.js';
import { PHASE1_WORLD_GRAPH, register } from '../src/routes/worldgraph.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const pool = await makeDb();
const accountId = 'mode-boundary-account';
const characterId = 'mode-boundary-character';
const crewId = 'mode-boundary-crew';
const operationId = 'mode-boundary-family';
const tx = (action) => withItemTransaction(pool, action);
const context = createOperationContext({ registry: PHASE1_WORLD_GRAPH, accountId });
const definition = operationDefinitions(PHASE1_WORLD_GRAPH, { publicOnly: true })[0];
const roleId = definition.roles[0].id;
const root = definition.root;
const nodeId = root.metadata.completionRequires[0];
const app = Fastify();
app.setErrorHandler((error, _req, reply) => reply.code(400).send({ error: error.code }));
register(app, { pool, auth: async (req) => { req.user = { sub: accountId }; } });
const snapshot = async () => {
  const result = {};
  for (const table of ['world_operations', 'world_operation_roles', 'world_operation_contributions',
    'world_operation_node_state', 'operation_escrow', 'item_instances', 'item_events', 'item_mutation_guards']) {
    result[table] = JSON.stringify((await pool.query(`SELECT * FROM ${table}`)).rows);
  }
  return result;
};
const insertFamily = async (id, graphId, version, operationNodeId) => pool.query(
  `INSERT INTO world_operations
    (id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
     coordination_mode,family_id,run_key,coordination_definition_hash,coordination_definition_json,
     expires_at,resolution_seed)
   VALUES ($1,$2,$3,$4,$5,$6,'recruiting','family','mode-boundary-family-id',$1,$7,'{}',$8,'seed')`,
  [id, graphId, version, operationNodeId, crewId, accountId, 'a'.repeat(64), new Date(Date.now() + 60000)],
);

try {
  await pool.query("INSERT INTO crews (id,name,leader_account) VALUES ($1,'Mode Crew',$2)", [crewId, accountId]);
  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc) VALUES ($1,$2,'Mode Player',1,'docks')`,
    [characterId, accountId],
  );
  await pool.query("INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,'Mode Player')", [crewId, accountId]);
  await insertFamily(operationId, root.packageId, PHASE1_WORLD_GRAPH.byPackage.get(root.packageId).version, root.id);
  await pool.query(
    `INSERT INTO world_operation_roles (operation_id,role_id,account_id,character_id) VALUES ($1,$2,$3,$4)`,
    [operationId, roleId, accountId, characterId],
  );
  const owner = { scope: 'account', id: accountId };
  const item = await tx((client) => createItem(client, owner, 'item:mode_boundary', 'imported', 'mode-create'));
  await tx((client) => escrowItem(client, owner, operationId, item.id, 'fixture', 'mode-escrow'));
  const calls = [
    { request: { action: 'assign_role', operationId, roleId }, run: (client, key) =>
      assignRole(client, context, operationId, roleId, { idempotencyKey: key }) },
    { request: { action: 'contribute', operationId, nodeId, interactionId: null }, run: (client, key) =>
      contribute(client, context, operationId, nodeId, { idempotencyKey: key }) },
    { request: { action: 'complete', operationId }, run: (client, key) =>
      completeOperation(client, context, operationId, { idempotencyKey: key }) },
    { request: { action: 'cancel', operationId }, run: (client, key) =>
      cancelOperation(client, context, operationId, { idempotencyKey: key }) },
  ];
  for (const [index, call] of calls.entries()) {
    const before = await snapshot();
    await assert.rejects(tx((client) => call.run(client, `fresh-${index}`)), { code: 'operation_not_found' });
    assert.deepEqual(await snapshot(), before, `${call.request.action} must preserve Family custody and state`);
    const replayKey = `replay-${index}`;
    await tx((client) => withItemMutation(client, owner, 'operation_action', replayKey, call.request,
      async () => ({ ok: true, sentinel: 'must not replay through Crew mode' })));
    const beforeReplay = await snapshot();
    await assert.rejects(tx((client) => call.run(client, replayKey)), { code: 'operation_not_found' });
    assert.deepEqual(await snapshot(), beforeReplay, `${call.request.action} must reject before replay`);
  }
  for (const board of [operationBoard, roleBoard]) {
    await assert.rejects(tx((client) => board(client, context, operationId)), { code: 'operation_not_found' });
  }
  for (const suffix of ['', '/role']) {
    const response = await app.inject(`/v1/worldgraph/operations/${operationId}${suffix}`);
    assert.equal(response.json().error, 'operation_unavailable', 'route hides a Family row even from its Crew and opener');
  }
  const discovery = await app.inject('/v1/worldgraph/operations');
  assert.equal(discovery.statusCode, 200, discovery.body);
  assert(!discovery.json().operations.some((entry) => entry.operationId === operationId));

  // An identically pinned Family run cannot be mistaken for the Crew operation on open.
  const registry = loadAndValidateGraphPackages([{
    id: 'mode-boundary-graph', version: 1, season: 'core', dependsOn: [], nodes: [
      { id: 'mode:root', type: 'social_gate', visibility: 'public', minimumDistinctAccounts: 2,
        roles: [{ id: 'first', distinct: true }, { id: 'second', distinct: true }],
        metadata: { closerRoleId: 'first', completionRequires: ['mode:first', 'mode:second'] } },
      ...['first', 'second'].map((id, index) => ({ id: `mode:${id}`, type: 'operation_step', visibility: 'public',
        requires: ['mode:root'], metadata: { operationId: 'mode:root', roleId: id, order: index + 1 } })),
    ],
  }]);
  await insertFamily('mode-open-family', 'mode-boundary-graph', 1, 'mode:root');
  const opened = await tx((client) => openOperation(client, createOperationContext({ registry, accountId }),
    'mode-boundary-graph', 'mode:root', 1, 'mode-open'));
  assert.notEqual(opened.operationId, 'mode-open-family');
  assert.equal((await pool.query('SELECT coordination_mode FROM world_operations WHERE id=$1', [opened.operationId]))
    .rows[0].coordination_mode, 'crew');
  console.log('coordination-mode-boundary: Family reads, mutation, replay, discovery, and open isolation PASS');
} finally {
  await app.close();
  await pool.end();
}
