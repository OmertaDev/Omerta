// Phase 1 vertical proof: one real car becomes conserved materials, a unique crafted tool, a
// character-pinned investigation input, and finally a four-account Crew operation contribution.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { craftWorldGraphRecipe, salvageCar } from '../src/crafting.js';
import { AUTOMOTIVE_SALVAGE_PACKAGE } from '../src/content/automotive-salvage.js';
import { BELLADONNA_PACKAGE } from '../src/content/belladonna.js';
import { CORE_MATERIALS_PACKAGE } from '../src/content/core-materials.js';
import {
  createItem,
  inventoryBoard,
  transferItem,
  withItemTransaction,
} from '../src/items.js';
import { runLedgerInvariants } from '../src/invariants.js';
import {
  cancelMystery,
  completeNode,
  createMysteryContext,
  mysteryBoard,
  startMystery,
} from '../src/mysteries.js';
import {
  assignRole,
  cancelOperation,
  completeOperation,
  contribute,
  createOperationContext,
  openOperation,
  operationBoard,
  roleBoard,
} from '../src/operations.js';
import { isWorldGraphRegistry } from '../src/worldgraph.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const GRAPH_ID = 'belladonna-demo';
const OPERATION_ID = 'operation:belladonna-lockbox';
const ACCOUNTS = Object.freeze([
  'belladonna-account-investigator',
  'belladonna-account-driver',
  'belladonna-account-mechanic',
  'belladonna-account-enforcer',
]);
const CHARACTERS = Object.freeze([
  'belladonna-character-investigator',
  'belladonna-character-driver',
  'belladonna-character-mechanic',
  'belladonna-character-enforcer',
]);
const ROLES = Object.freeze(['investigator', 'driver', 'mechanic', 'enforcer']);
const CREW_ID = 'belladonna-crew-internal';
const CAR_ID = 'belladonna-owned-junker';
const ACCOUNT_OWNER = Object.freeze({ scope: 'account', id: ACCOUNTS[0] });
const CHARACTER_OWNER = Object.freeze({ scope: 'character', id: CHARACTERS[0] });
const MECHANIC_OWNER = Object.freeze({ scope: 'account', id: ACCOUNTS[2] });
const INVESTIGATOR_EVIDENCE = 'The fourth petal marks the false hinge.';
const MECHANIC_EVIDENCE = 'The maker reversed the last two gates.';

const registry = loadAndValidateGraphPackages([
  CORE_MATERIALS_PACKAGE,
  AUTOMOTIVE_SALVAGE_PACKAGE,
  BELLADONNA_PACKAGE,
]);
assert.equal(isWorldGraphRegistry(registry), true);
assert(Object.isFrozen(BELLADONNA_PACKAGE));
assert(Object.isFrozen(BELLADONNA_PACKAGE.nodes));
assert(Object.isFrozen(BELLADONNA_PACKAGE.nodes[0].conditions));
assert.throws(() => { BELLADONNA_PACKAGE.nodes[0].id = 'tampered'; }, TypeError,
  'the shipped package is immutable before registry loading');
assert.equal(BELLADONNA_PACKAGE.nodes.filter(({ type }) => type === 'recipe').length, 0,
  'Belladonna reuses the validated automotive recipe package instead of copying runtime values');
const authoredText = JSON.stringify(BELLADONNA_PACKAGE).toLowerCase();
for (const forbidden of ['"omr"', '"cash"', '"sql"', 'javascript', 'function']) {
  assert.equal(authoredText.includes(forbidden), false,
    `Belladonna data cannot declare ${forbidden} authority`);
}
assert.deepEqual(
  BELLADONNA_PACKAGE.dependsOn,
  ['core-materials', 'automotive-salvage'],
  'the proof declares its exact package dependency closure',
);
assert.equal(registry.nodes.get('item:belladonna_artifact').metadata.inert, true);
assert.equal(registry.nodes.get('item:belladonna_artifact').metadata.tradeable, false);
assert.equal(registry.nodes.get('reward:belladonna-crew-status').repeatability, undefined,
  'the inert status target declares no ignored generic repeatability authority');
assert.deepEqual(registry.nodes.get('reward:belladonna-crew-status').requires, [OPERATION_ID],
  'the inert status target is completed only by its exact operation source');
const malformedPrivateEvidence = structuredClone(BELLADONNA_PACKAGE);
malformedPrivateEvidence.nodes.find(
  ({ id }) => id === 'evidence:belladonna-cipher-fragment',
).metadata.privateEvidence = { text: INVESTIGATOR_EVIDENCE };
assert.throws(
  () => loadAndValidateGraphPackages([
    CORE_MATERIALS_PACKAGE, AUTOMOTIVE_SALVAGE_PACKAGE, malformedPrivateEvidence,
  ]),
  (error) => error?.code === 'invalid_private_evidence',
  'static acceptance rejects non-string private projection authority',
);
const publicPrivateEvidence = structuredClone(BELLADONNA_PACKAGE);
publicPrivateEvidence.nodes.find(
  ({ id }) => id === 'evidence:belladonna-cipher-fragment',
).visibility = 'public';
assert.throws(
  () => loadAndValidateGraphPackages([
    CORE_MATERIALS_PACKAGE, AUTOMOTIVE_SALVAGE_PACKAGE, publicPrivateEvidence,
  ]),
  (error) => error?.code === 'invalid_private_evidence',
  'private clue text cannot be placed on a public node',
);

const mysteryContexts = ACCOUNTS.map((accountId) => createMysteryContext({
  registry,
  accountId,
  now: '2026-09-03T20:00:00.000Z',
}));
const operationContexts = ACCOUNTS.map((accountId) => createOperationContext({
  registry,
  accountId,
  now: '2026-09-03T20:00:00.000Z',
}));

const pool = await makeDb();
const tx = (action) => withItemTransaction(pool, action);
const mysteryAct = (index, fn, ...args) => tx(
  (client) => fn(client, mysteryContexts[index], ...args),
);
const operationAct = (index, fn, ...args) => tx(
  (client) => fn(client, operationContexts[index], ...args),
);
const count = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);
const stackQty = (board, templateId) => (
  board.stacks.find(({ templateId: id }) => id === templateId)?.qty || 0
);
const balances = async () => Promise.all(ACCOUNTS.map(async (accountId, index) => ({
  accountId,
  cash: Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [CHARACTERS[index]],
  )).rows[0].cash),
  omr: Number((await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
  )).rows[0].omr),
})));
const safeJson = (value) => JSON.stringify(value);

async function prepareRecoveryOperation(label) {
  const prefix = `belladonna-${label}`;
  const accounts = ROLES.map((role) => `${prefix}-${role}-account`);
  const characters = ROLES.map((role) => `${prefix}-${role}-character`);
  const crewId = `${prefix}-crew`;
  const contexts = accounts.map((accountId) => createOperationContext({ registry, accountId }));
  const act = (index, fn, ...args) => tx((client) => fn(client, contexts[index], ...args));
  await pool.query(
    'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
    [crewId, `${prefix}-name`, accounts[0]],
  );
  for (let index = 0; index < accounts.length; index += 1) {
    await pool.query(
      `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
       VALUES ($1,$2,$3,1,'foundry',10000,1000)`,
      [characters[index], accounts[index], `${prefix}-operator-${index}`],
    );
    await pool.query(
      'INSERT INTO account_persistent (account_id,omr) VALUES ($1,100)', [accounts[index]],
    );
    await pool.query(
      'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
      [crewId, accounts[index], `${prefix}-member-${index}`],
    );
  }
  await pool.query(
    "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network')",
    [characters[2]],
  );
  const mysteryId = `${prefix}-mystery`;
  await pool.query(
    `INSERT INTO mystery_instances
       (id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,completed_at)
     VALUES ($1,'character',$2,$3,$4,1,'completed',now())`,
    [mysteryId, characters[0], accounts[0], GRAPH_ID],
  );
  await pool.query(
    `INSERT INTO mystery_node_state
       (instance_id,node_id,state,discovered_at,completed_at)
     VALUES ($1,'mystery:belladonna-file-closed','completed',now(),now())`,
    [mysteryId],
  );
  const tool = await tx((client) => createItem(
    client,
    { scope: 'account', id: accounts[2] },
    'item:precision_lock_tool',
    'crafted',
    `${prefix}-crafted-tool`,
  ));
  const operation = await act(
    0, openOperation, GRAPH_ID, OPERATION_ID, 1, `${prefix}-open`,
  );
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, assignRole, operation.operationId, ROLES[index], {
      idempotencyKey: `${prefix}-assign-${ROLES[index]}`,
    });
  }
  await act(0, contribute, operation.operationId, 'operation:belladonna-investigate', {
    idempotencyKey: `${prefix}-investigate`,
    interactionId: 'read_belladonna_cipher',
  });
  await act(1, contribute, operation.operationId, 'operation:belladonna-drive', {
    idempotencyKey: `${prefix}-drive`,
    interactionId: 'stage_belladonna_car',
  });
  await act(2, contribute, operation.operationId, 'operation:belladonna-mechanic', {
    idempotencyKey: `${prefix}-mechanic`,
  });
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1 AND item_id=$2',
    [operation.operationId, tool.id],
  ), 1);
  return { prefix, accounts, characters, crewId, contexts, act, operation, tool };
}

try {
  await pool.query(
    `INSERT INTO crews (id,name,leader_account)
     VALUES ($1,'Belladonna Crew',$2)`,
    [CREW_ID, ACCOUNTS[0]],
  );
  for (let index = 0; index < ACCOUNTS.length; index += 1) {
    await pool.query(
      `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
       VALUES ($1,$2,$3,1,'foundry',10000,10000)`,
      [CHARACTERS[index], ACCOUNTS[index], `Belladonna Operator ${index + 1}`],
    );
    await pool.query(
      'INSERT INTO account_persistent (account_id,omr) VALUES ($1,$2)',
      [ACCOUNTS[index], 700 + index],
    );
    await pool.query(
      'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
      [CREW_ID, ACCOUNTS[index], `Belladonna Operator ${index + 1}`],
    );
  }
  await pool.query(
    `INSERT INTO character_skills (character_id,skill_id)
     VALUES ($1,'fence_network'),($2,'fence_network')`,
    [CHARACTERS[0], CHARACTERS[2]],
  );
  await pool.query(
    `INSERT INTO cars
       (id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip)
     VALUES ($1,$2,'junker','stock',73,false,false,false,null,false)`,
    [CAR_ID, CHARACTERS[0]],
  );

  const moneyAtStart = await balances();
  const transactionsAtStart = await count('SELECT COUNT(*) AS n FROM transactions');
  const invariantCheck = async (name) => (await runLedgerInvariants(pool, { alert: false }))
    .checks.find((check) => check.name === name);
  const carDriftAtStart = (await invariantCheck('car conservation')).drift;
  const craftingIdentity = {
    accountId: ACCOUNTS[0],
    // This is only the documented response-cache surface. The crafting runtime reloads and locks
    // the actual car, location, skill, progression, and owner rows.
    owned: { cars: [{ id: CAR_ID, model_id: 'junker', trim_id: 'stock' }] },
  };

  const salvaged = await tx((client) => salvageCar(
    client,
    craftingIdentity,
    CAR_ID,
    'recipe:car_salvage_basic',
    'belladonna-salvage-car',
  ));
  assert.deepEqual(salvaged.outputs.map(({ templateId, delta }) => ({ templateId, delta })), [
    { templateId: 'mat:scrap_steel', delta: 6 },
    { templateId: 'mat:wire', delta: 2 },
    { templateId: 'mat:salvage_parts', delta: 2 },
  ]);
  assert.equal(await count('SELECT COUNT(*) AS n FROM cars WHERE id=$1', [CAR_ID]), 0,
    'the eligible owned car is consumed exactly once');
  const salvageAudit = await invariantCheck('world graph salvage car audit');
  assert.equal(salvageAudit.ok, true,
    'the completed salvage guard is a valid authoritative noncurrency car sink');
  assert.equal(salvageAudit.logicalSinks, 1,
    'one successful logical guard counts as exactly one salvage sink');
  assert.deepEqual(salvageAudit.carIds, [CAR_ID],
    'the sink identity comes from the server-derived completed result');
  assert.equal((await invariantCheck('car conservation')).drift, carDriftAtStart,
    'successful salvage moves the held-car side and authoritative sink side together');
  assert.equal(await count('SELECT COUNT(*) AS n FROM transactions'), transactionsAtStart,
    'cashless salvage writes no currency transaction row');
  assert.deepEqual(await tx((client) => salvageCar(
    client,
    craftingIdentity,
    CAR_ID,
    'recipe:car_salvage_basic',
    'belladonna-salvage-car',
  )), salvaged, 'vehicle disposal is exactly replay-safe');
  await assert.rejects(
    tx((client) => salvageCar(
      client,
      craftingIdentity,
      CAR_ID,
      'recipe:car_salvage_basic',
      'belladonna-salvage-car-second-logical-action',
    )),
    (error) => error?.code === 'no_car',
    'a fresh logical action cannot sink an already-salvaged car',
  );
  const salvageAuditAfterReplay = await invariantCheck('world graph salvage car audit');
  assert.equal(salvageAuditAfterReplay.logicalSinks, 1,
    'replay and failed retry create no additional logical car sink');
  assert.equal((await invariantCheck('car conservation')).drift, carDriftAtStart,
    'replay and failure leave car conservation unchanged');
  assert.equal(await count('SELECT COUNT(*) AS n FROM transactions'), transactionsAtStart,
    'replay and failed retry remain currency-ledger neutral');

  const guardResult = (await pool.query(
    `SELECT result_json FROM item_mutation_guards
      WHERE idempotency_key='belladonna-salvage-car'`,
  )).rows[0].result_json;
  const guardResultText = typeof guardResult === 'string'
    ? guardResult : JSON.stringify(guardResult);
  const malformedResult = JSON.parse(guardResultText);
  malformedResult.inputs.push({ assetType: 'car', quantity: 1, id: 'forged-second-car' });
  await pool.query(
    `UPDATE item_mutation_guards SET result_json=$1
      WHERE idempotency_key='belladonna-salvage-car'`,
    [JSON.stringify(malformedResult)],
  );
  assert.equal((await invariantCheck('world graph salvage car audit')).ok, false,
    'a completed guard that does not encode exactly one matching server-derived car fails closed');
  await pool.query(
    `UPDATE item_mutation_guards SET result_json=$1
      WHERE idempotency_key='belladonna-salvage-car'`,
    [guardResultText],
  );
  assert.equal((await invariantCheck('world graph salvage car audit')).ok, true,
    'restoring the exact completed result returns the salvage audit to green');

  const hardened = await tx((client) => craftWorldGraphRecipe(
    client, craftingIdentity, 'recipe:hardened_steel', 'belladonna-harden-steel',
  ));
  assert.equal(hardened.inputs[0].templateId, 'mat:scrap_steel');
  assert.equal(hardened.inputs[0].delta, -4);
  assert.equal(hardened.outputs[0].templateId, 'mat:hardened_steel');
  assert.equal(hardened.outputs[0].delta, 1);
  assert.equal(hardened.cashCost, 300);

  const crafted = await tx((client) => craftWorldGraphRecipe(
    client, craftingIdentity, 'recipe:precision_lock_tool', 'belladonna-craft-tool',
  ));
  const toolId = crafted.outputs[0].id;
  assert.equal(crafted.outputs[0].templateId, 'item:precision_lock_tool');
  assert.deepEqual(await tx((client) => craftWorldGraphRecipe(
    client, craftingIdentity, 'recipe:precision_lock_tool', 'belladonna-craft-tool',
  )), crafted, 'the permanent unique tool id is stable on replay');

  const productionBoard = await inventoryBoard(pool, ACCOUNT_OWNER);
  assert.equal(stackQty(productionBoard, 'mat:scrap_steel'), 2);
  assert.equal(stackQty(productionBoard, 'mat:wire'), 2);
  assert.equal(stackQty(productionBoard, 'mat:salvage_parts'), 0);
  assert.equal(stackQty(productionBoard, 'mat:hardened_steel'), 0);
  assert.equal(productionBoard.items.filter(({ id }) => id === toolId).length, 1);
  const afterProduction = await balances();
  assert.equal(afterProduction[0].cash, moneyAtStart[0].cash - 300,
    'the only cash movement is the declared hardened-steel recipe cost');
  assert.deepEqual(
    afterProduction.map(({ omr }) => omr),
    moneyAtStart.map(({ omr }) => omr),
    'the complete production chain cannot move OMR',
  );
  assert.equal(await count('SELECT COUNT(*) AS n FROM transactions'), transactionsAtStart + 1);
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM transactions
      WHERE character_id=$1 AND currency='cash' AND amount=-300
        AND reason='craft:recipe:hardened_steel'`,
    [CHARACTERS[0]],
  ), 1, 'the one declared cash cost has one ordinary ledger row');

  // The crafted account item is deliberately moved to the exact living character before the
  // individual investigation. A sibling account cannot start or drive this character-pinned case.
  const pinnedTool = await tx((client) => transferItem(
    client,
    ACCOUNT_OWNER,
    CHARACTER_OWNER,
    toolId,
    'pin precision tool to Belladonna investigator',
    'belladonna-tool-to-character',
  ));
  assert.deepEqual(pinnedTool.owner, CHARACTER_OWNER);
  const started = await mysteryAct(
    0, startMystery, CHARACTER_OWNER, GRAPH_ID, BELLADONNA_PACKAGE.version,
  );
  assert.equal(started.owner.scope, 'character');
  assert.equal(started.owner.id, CHARACTERS[0]);
  assert.equal(started.graph.version, 1);
  await assert.rejects(
    mysteryAct(0, startMystery, CHARACTER_OWNER, GRAPH_ID, 2),
    (error) => error?.code === 'graph_version',
    'the character instance cannot be silently reinterpreted by an unavailable package version',
  );
  await assert.rejects(
    mysteryAct(1, startMystery, CHARACTER_OWNER, GRAPH_ID, BELLADONNA_PACKAGE.version),
    (error) => error?.code === 'mystery_owner_forbidden',
    'another account cannot drive the character-pinned investigation',
  );
  assert.deepEqual((await pool.query(
    `SELECT owner_scope,owner_id,authority_account_id,graph_id,graph_version
       FROM mystery_instances WHERE id=$1`,
    [started.instanceId],
  )).rows[0], {
    owner_scope: 'character',
    owner_id: CHARACTERS[0],
    authority_account_id: ACCOUNTS[0],
    graph_id: GRAPH_ID,
    graph_version: 1,
  }, 'runtime state pins both the exact character and its authenticated account to package v1');

  await assert.rejects(
    operationAct(
      0, openOperation, GRAPH_ID, OPERATION_ID, 1, 'belladonna-open-before-mystery',
    ),
    (error) => error?.code === 'operation_locked',
    'the Crew operation cannot open from client intent before the mystery bridge completes',
  );
  await assert.rejects(
    mysteryAct(0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-trace', {
      idempotencyKey: 'belladonna-trace',
      interactionId: 'guessed_stamp',
    }),
    (error) => error?.code === 'interaction',
  );
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='belladonna-trace'",
  ), 0, 'a refused mystery interaction leaves no stale replay reservation');
  const traced = await mysteryAct(
    0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-trace', {
      idempotencyKey: 'belladonna-trace',
      interactionId: 'inspect_belladonna_stamp',
    },
  );
  assert.equal(traced.node.status, 'completed');

  await assert.rejects(
    mysteryAct(0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-lock', {
      idempotencyKey: 'belladonna-lock',
      interactionId: 'force_tumblers',
    }),
    (error) => error?.code === 'interaction',
  );
  let toolRow = (await pool.query(
    'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [toolId],
  )).rows[0];
  assert.deepEqual(toolRow, {
    owner_scope: 'character', owner_id: CHARACTERS[0], state: 'active',
  }, 'a failed investigation condition cannot partially escrow the unique tool');
  const unlocked = await mysteryAct(
    0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-lock', {
      idempotencyKey: 'belladonna-lock',
      interactionId: 'set_precision_tumblers',
    },
  );
  assert.equal(unlocked.node.status, 'completed');
  toolRow = (await pool.query(
    'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [toolId],
  )).rows[0];
  assert.deepEqual(toolRow, {
    owner_scope: 'operation', owner_id: started.instanceId, state: 'escrowed',
  }, 'the declared exact item template enters only this mystery instance custody');
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE item_id=$1 AND operation_id=$2',
    [toolId, started.instanceId],
  ), 1);
  assert.deepEqual(await mysteryAct(
    0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-lock', {
      idempotencyKey: 'belladonna-lock',
      interactionId: 'set_precision_tumblers',
    },
  ), unlocked, 'investigation replay cannot escrow or grant evidence twice');
  const investigation = await mysteryBoard(
    pool, mysteryContexts[0], CHARACTER_OWNER, GRAPH_ID,
  );
  assert(investigation.nodes.some(({ id, status }) => (
    id === 'evidence:belladonna-maker-mark' && status === 'completed'
  )));
  assert(investigation.nodes.some(({ id }) => id === 'mystery:belladonna-file-closed'));
  assert.equal(investigation.nodes.some(({ id }) => [
    'evidence:belladonna-cipher-fragment',
    'evidence:belladonna-tumbler-pattern',
    'reward:belladonna-crew-status',
  ].includes(id)), false,
  'the mystery board never leaks operation-owned evidence or status targets from the same package');

  const closed = await mysteryAct(
    0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-file-closed', {
      idempotencyKey: 'belladonna-close-mystery',
      interactionId: 'seal_belladonna_file',
    },
  );
  assert.equal(closed.status, 'completed');
  assert.equal(closed.releasedEscrowCount, 1);
  assert.deepEqual(await mysteryAct(
    0, completeNode, CHARACTER_OWNER, GRAPH_ID, 'mystery:belladonna-file-closed', {
      idempotencyKey: 'belladonna-close-mystery',
      interactionId: 'seal_belladonna_file',
    },
  ), closed, 'closed mystery replay is exact and does not release twice');
  toolRow = (await pool.query(
    'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [toolId],
  )).rows[0];
  assert.deepEqual(toolRow, {
    owner_scope: 'character', owner_id: CHARACTERS[0], state: 'active',
  }, 'terminal completion returns custody to the exact character depositor');

  const opened = await operationAct(
    0, openOperation, GRAPH_ID, OPERATION_ID, 1, 'belladonna-open-operation',
  );
  assert.equal(opened.graph.version, 1);
  assert.equal(opened.status, 'forming');
  await assert.rejects(
    operationAct(
      0, openOperation, GRAPH_ID, OPERATION_ID, 2, 'belladonna-open-wrong-version',
    ),
    (error) => error?.code === 'graph_version',
    'the operation cannot be opened against a different content version',
  );
  assert(!safeJson(opened).includes(CREW_ID));
  for (let index = 0; index < ROLES.length; index += 1) {
    const assigned = await operationAct(index, assignRole, opened.operationId, ROLES[index], {
      idempotencyKey: `belladonna-role-${ROLES[index]}`,
    });
    assert.equal(assigned.assignment.roleId, ROLES[index]);
  }
  assert.equal(await count(
    'SELECT COUNT(DISTINCT account_id) AS n FROM world_operation_roles WHERE operation_id=$1',
    [opened.operationId],
  ), 4, 'the Belladonna operation has four server-enforced distinct accounts');

  const publicBoard = await operationBoard(pool, operationContexts[0], opened.operationId);
  assert.equal(publicBoard.status, 'active');
  assert.equal(publicBoard.requiredRoleCount, 4);
  for (const privateId of [
    'operation:belladonna-investigate',
    'operation:belladonna-mechanic',
    'evidence:belladonna-cipher-fragment',
    'evidence:belladonna-tumbler-pattern',
  ]) assert(!safeJson(publicBoard).includes(privateId), 'the shared board hides private graph ids');
  assert(!safeJson(publicBoard).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(publicBoard).includes(id)));

  // Every Belladonna branch is ordered. Refused future-role calls leave neither progress nor a
  // durable replay reservation, so clients cannot skip ahead by guessing contribution ids.
  for (const [index, nodeId, key, interactionId] of [
    [1, 'operation:belladonna-drive', 'belladonna-early-driver', 'stage_belladonna_car'],
    [2, 'operation:belladonna-mechanic', 'belladonna-early-mechanic', null],
    [3, 'operation:belladonna-enforce', 'belladonna-early-enforcer', 'secure_belladonna_room'],
  ]) {
    await assert.rejects(
      operationAct(index, contribute, opened.operationId, nodeId, {
        idempotencyKey: key,
        ...(interactionId ? { interactionId } : {}),
      }),
      (error) => ['operation_prerequisite', 'operation_order'].includes(error?.code),
    );
    assert.equal(await count(
      'SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1', [key],
    ), 0);
  }
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM world_operation_contributions WHERE operation_id=$1',
    [opened.operationId],
  ), 0);

  const unavailable = [];
  for (const nodeId of [
    'operation:belladonna-does-not-exist',
    'reward:belladonna-crew-status',
    'operation:belladonna-mechanic',
  ]) {
    let rejection = null;
    await assert.rejects(
      operationAct(0, contribute, opened.operationId, nodeId, {
        idempotencyKey: 'belladonna-private-oracle',
      }),
      (error) => {
        rejection = { code: error.code, message: error.message };
        return true;
      },
      'private contribution guess unexpectedly executed',
    );
    unavailable.push(rejection);
  }
  assert.deepEqual(unavailable, [unavailable[0], unavailable[0], unavailable[0]],
    'nonexistent, hidden, and another role-private ids are indistinguishable');
  assert(!safeJson(unavailable).includes(INVESTIGATOR_EVIDENCE));
  assert(!safeJson(unavailable).includes(MECHANIC_EVIDENCE));

  const investigatorContribution = await operationAct(
    0, contribute, opened.operationId, 'operation:belladonna-investigate', {
      idempotencyKey: 'belladonna-contribute-investigator',
      interactionId: 'read_belladonna_cipher',
    },
  );
  assert(!safeJson(investigatorContribution).includes('evidence:belladonna-cipher-fragment'),
    'private evidence identity is delivered only through the role board');
  assert(!safeJson(investigatorContribution).includes(INVESTIGATOR_EVIDENCE));
  assert.deepEqual(await operationAct(
    0, contribute, opened.operationId, 'operation:belladonna-investigate', {
      idempotencyKey: 'belladonna-contribute-investigator',
      interactionId: 'read_belladonna_cipher',
    },
  ), investigatorContribution, 'a contribution replay carries no private clue oracle');
  await assert.rejects(
    operationAct(0, contribute, opened.operationId, 'operation:belladonna-drive', {
      idempotencyKey: 'belladonna-contribute-investigator',
      interactionId: 'stage_belladonna_car',
    }),
    (error) => error?.code === 'idempotency_conflict',
    'one contribution key cannot be rebound to a different Belladonna branch',
  );
  const investigatorPrivate = await roleBoard(
    pool, operationContexts[0], opened.operationId,
  );
  assert.deepEqual(investigatorPrivate.nodes.find(
    ({ id }) => id === 'evidence:belladonna-cipher-fragment',
  )?.privateEvidence, INVESTIGATOR_EVIDENCE);
  assert(!investigatorPrivate.nodes.some(({ id }) => id === 'evidence:belladonna-tumbler-pattern'));
  assert(!safeJson(investigatorPrivate).includes(MECHANIC_EVIDENCE));
  const mechanicBefore = await roleBoard(pool, operationContexts[2], opened.operationId);
  assert(!mechanicBefore.nodes.some(({ id }) => id === 'evidence:belladonna-cipher-fragment'));
  assert(mechanicBefore.nodes.some(({ id }) => id === 'operation:belladonna-mechanic'));
  assert(!safeJson(mechanicBefore).includes(INVESTIGATOR_EVIDENCE));

  await operationAct(
    1, contribute, opened.operationId, 'operation:belladonna-drive', {
      idempotencyKey: 'belladonna-contribute-driver',
      interactionId: 'stage_belladonna_car',
    },
  );
  await assert.rejects(
    operationAct(
      2, contribute, opened.operationId, 'operation:belladonna-mechanic', {
        idempotencyKey: 'belladonna-contribute-mechanic',
      },
    ),
    (error) => error?.code === 'item_unavailable',
    'the mechanic cannot nominate or borrow the investigator character item from the request',
  );
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='belladonna-contribute-mechanic'",
  ), 0, 'a refused operation contribution rolls its logical reservation back');

  const mechanicTool = await tx((client) => transferItem(
    client,
    CHARACTER_OWNER,
    MECHANIC_OWNER,
    toolId,
    'entrust crafted Belladonna tool to Crew mechanic',
    'belladonna-tool-to-mechanic',
  ));
  assert.deepEqual(mechanicTool.owner, MECHANIC_OWNER);
  const mechanicContribution = await operationAct(
    2, contribute, opened.operationId, 'operation:belladonna-mechanic', {
      idempotencyKey: 'belladonna-contribute-mechanic',
    },
  );
  assert.equal(mechanicContribution.effects.find(({ kind }) => kind === 'item_escrow')
    .item.id, toolId, 'the mechanic contributes the exact uniquely crafted item');
  assert(!safeJson(mechanicContribution).includes('evidence:belladonna-tumbler-pattern'));
  assert(!safeJson(mechanicContribution).includes(MECHANIC_EVIDENCE));
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1 AND item_id=$2',
    [opened.operationId, toolId],
  ), 1);
  assert.deepEqual(await operationAct(
    2, contribute, opened.operationId, 'operation:belladonna-mechanic', {
      idempotencyKey: 'belladonna-contribute-mechanic',
    },
  ), mechanicContribution, 'the mechanic contribution cannot duplicate operation custody');
  const mechanicPrivate = await roleBoard(pool, operationContexts[2], opened.operationId);
  assert.deepEqual(mechanicPrivate.nodes.find(
    ({ id }) => id === 'evidence:belladonna-tumbler-pattern',
  )?.privateEvidence, MECHANIC_EVIDENCE);
  assert(!mechanicPrivate.nodes.some(({ id }) => id === 'evidence:belladonna-cipher-fragment'));
  assert(!safeJson(mechanicPrivate).includes(INVESTIGATOR_EVIDENCE));

  for (const roleIndex of [1, 3]) {
    const uninvolvedRoleBoard = await roleBoard(
      pool, operationContexts[roleIndex], opened.operationId,
    );
    assert(!safeJson(uninvolvedRoleBoard).includes(INVESTIGATOR_EVIDENCE));
    assert(!safeJson(uninvolvedRoleBoard).includes(MECHANIC_EVIDENCE));
    assert(!uninvolvedRoleBoard.nodes.some(({ id }) => (
      id === 'evidence:belladonna-cipher-fragment'
      || id === 'evidence:belladonna-tumbler-pattern'
    )), `${ROLES[roleIndex]} cannot see either role-private evidence id`);
  }

  const publicAfterEvidence = await operationBoard(pool, operationContexts[1], opened.operationId);
  assert(!safeJson(publicAfterEvidence).includes(INVESTIGATOR_EVIDENCE));
  assert(!safeJson(publicAfterEvidence).includes(MECHANIC_EVIDENCE));
  assert(!safeJson(publicAfterEvidence).includes('evidence:belladonna-cipher-fragment'));
  assert(!safeJson(publicAfterEvidence).includes('evidence:belladonna-tumbler-pattern'));

  await operationAct(
    3, contribute, opened.operationId, 'operation:belladonna-enforce', {
      idempotencyKey: 'belladonna-contribute-enforcer',
      interactionId: 'secure_belladonna_room',
    },
  );
  assert.equal(await count(
    'SELECT COUNT(DISTINCT role_id) AS n FROM world_operation_contributions WHERE operation_id=$1',
    [opened.operationId],
  ), 4, 'all four ordered role branches have converged');
  await assert.rejects(
    operationAct(1, completeOperation, opened.operationId, {
      idempotencyKey: 'belladonna-close-wrong-role',
    }),
    (error) => error?.code === 'operation_completion_role',
  );

  const [completionA, completionB] = await Promise.all([
    operationAct(0, completeOperation, opened.operationId, {
      idempotencyKey: 'belladonna-complete-a',
    }),
    operationAct(0, completeOperation, opened.operationId, {
      idempotencyKey: 'belladonna-complete-b',
    }),
  ]);
  assert.equal(completionA.status, 'completed');
  assert.equal(completionB.status, 'completed');
  assert.equal(completionA.releasedEscrowCount + completionB.releasedEscrowCount, 1);
  assert.deepEqual(await operationAct(0, completeOperation, opened.operationId, {
    idempotencyKey: 'belladonna-complete-a',
  }), completionA, 'terminal replay returns the stored result without awarding again');
  await assert.rejects(
    operationAct(0, cancelOperation, opened.operationId, {
      idempotencyKey: 'belladonna-complete-a',
    }),
    (error) => error?.code === 'idempotency_conflict',
    'a terminal key cannot be rebound from completion to cancellation',
  );
  for (const completion of [completionA, completionB]) {
    assert(!safeJson(completion).includes(CREW_ID));
    assert(!ACCOUNTS.some((id) => safeJson(completion).includes(id)));
    assert(!safeJson(completion).includes('evidence:belladonna-cipher-fragment'));
    assert(!safeJson(completion).includes('evidence:belladonna-tumbler-pattern'));
  }
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_instances
      WHERE template_id='item:belladonna_artifact' AND owner_scope='account' AND owner_id=$1
        AND state='active'`,
    [ACCOUNTS[0]],
  ), 1, 'only the graph-declared investigator role receives the inert artifact');
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_instances
      WHERE template_id='item:belladonna_artifact' AND owner_id<>$1`,
    [ACCOUNTS[0]],
  ), 0, 'no other role receives a copy of the unique artifact');
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM world_operation_node_state
      WHERE operation_id=$1 AND node_id='reward:belladonna-crew-status' AND state='completed'`,
    [opened.operationId],
  ), 1, 'the finite inert shared status is awarded exactly once');
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_instances
      WHERE template_id='item:belladonna_artifact'`,
  ), 1,
  'Belladonna deliberately creates one mystery artifact; Task 6 separately proves multi-role awards');
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE item_id=$1', [toolId],
  ), 0, 'terminal convergence leaves no item in custody');
  const finalMechanicBoard = await inventoryBoard(pool, MECHANIC_OWNER);
  assert(finalMechanicBoard.items.some(({ id, state }) => id === toolId && state === 'active'),
    'the contributed crafted item returns to its mechanic depositor');

  const toolEvents = (await pool.query(
    `SELECT event_kind,provenance_kind FROM item_events
      WHERE item_id=$1 ORDER BY sequence`, [toolId],
  )).rows;
  assert.deepEqual(toolEvents, [
    { event_kind: 'created', provenance_kind: 'crafted' },
    { event_kind: 'transferred', provenance_kind: 'transferred' },
    { event_kind: 'escrowed', provenance_kind: 'used_in_mystery' },
    { event_kind: 'released', provenance_kind: 'transferred' },
    { event_kind: 'transferred', provenance_kind: 'transferred' },
    { event_kind: 'escrowed', provenance_kind: 'used_in_operation' },
    { event_kind: 'released', provenance_kind: 'transferred' },
  ], 'one permanent item id retains the complete crafting, mystery, and operation provenance');
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_instances
      WHERE id=$1 AND template_id='item:precision_lock_tool'`, [toolId],
  ), 1, 'the complete vertical slice never duplicates its unique tool');

  // A second character-pinned investigation reuses that same permanent tool to prove the recovery
  // path: cancellation remains available after character death and returns custody exactly once.
  const mechanicCharacterOwner = Object.freeze({ scope: 'character', id: CHARACTERS[2] });
  await tx((client) => transferItem(
    client,
    MECHANIC_OWNER,
    mechanicCharacterOwner,
    toolId,
    'pin Belladonna tool to mechanic street for cancellation proof',
    'belladonna-cancel-tool-to-character',
  ));
  const cancelInstance = await mysteryAct(
    2, startMystery, mechanicCharacterOwner, GRAPH_ID, 1,
  );
  await mysteryAct(
    2, completeNode, mechanicCharacterOwner, GRAPH_ID, 'mystery:belladonna-trace', {
      idempotencyKey: 'belladonna-cancel-trace',
      interactionId: 'inspect_belladonna_stamp',
    },
  );
  await mysteryAct(
    2, completeNode, mechanicCharacterOwner, GRAPH_ID, 'mystery:belladonna-lock', {
      idempotencyKey: 'belladonna-cancel-lock',
      interactionId: 'set_precision_tumblers',
    },
  );
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1 AND item_id=$2',
    [cancelInstance.instanceId, toolId],
  ), 1);
  const cancellationReleasesBefore = await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
    [toolId],
  );
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[2]]);
  const canceledMystery = await mysteryAct(
    2, cancelMystery, mechanicCharacterOwner, GRAPH_ID, cancelInstance.instanceId, {
      idempotencyKey: 'belladonna-cancel-after-death',
    },
  );
  assert.equal(canceledMystery.status, 'canceled');
  assert.equal(canceledMystery.releasedEscrowCount, 1);
  assert.deepEqual(await mysteryAct(
    2, cancelMystery, mechanicCharacterOwner, GRAPH_ID, cancelInstance.instanceId, {
      idempotencyKey: 'belladonna-cancel-after-death',
    },
  ), canceledMystery, 'dead-character cancellation replays without releasing twice');
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
    [toolId],
  ), cancellationReleasesBefore + 1);
  assert.deepEqual((await pool.query(
    'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [toolId],
  )).rows[0], {
    owner_scope: 'character', owner_id: CHARACTERS[2], state: 'active',
  });
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1',
    [cancelInstance.instanceId],
  ), 0);
  await assert.rejects(
    mysteryAct(
      2, completeNode, mechanicCharacterOwner, GRAPH_ID, 'mystery:belladonna-file-closed', {
        idempotencyKey: 'belladonna-cancel-after-death',
        interactionId: 'seal_belladonna_file',
      },
    ),
    (error) => error?.code === 'idempotency_conflict',
    'the cancellation key cannot be rebound to a terminal mystery action',
  );
  await pool.query('UPDATE characters SET alive=true WHERE id=$1', [CHARACTERS[2]]);

  // Belladonna-specific invalidation fixtures stop immediately after the mechanic deposits the
  // exact declared tool. Death takes the automatic abandonment path; a Crew move takes the explicit
  // opener-cancellation recovery path. Neither may run terminal rewards.
  const rewardsBeforeRecovery = await count(
    "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:belladonna_artifact'",
  );
  const deathRecovery = await prepareRecoveryOperation('death-recovery');
  await pool.query(
    'UPDATE characters SET alive=false WHERE id=$1', [deathRecovery.characters[1]],
  );
  const deathReleaseBefore = await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
    [deathRecovery.tool.id],
  );
  const abandoned = await deathRecovery.act(
    3, contribute, deathRecovery.operation.operationId, 'operation:belladonna-enforce', {
      idempotencyKey: `${deathRecovery.prefix}-trigger-death`,
      interactionId: 'secure_belladonna_room',
    },
  );
  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.closeReason, 'participant_dead');
  assert.equal(abandoned.releasedEscrowCount, 1);
  assert.deepEqual(await deathRecovery.act(
    3, contribute, deathRecovery.operation.operationId, 'operation:belladonna-enforce', {
      idempotencyKey: `${deathRecovery.prefix}-trigger-death`,
      interactionId: 'secure_belladonna_room',
    },
  ), abandoned, 'the abandonment trigger replays without releasing twice');
  await assert.rejects(
    deathRecovery.act(0, cancelOperation, deathRecovery.operation.operationId, {
      idempotencyKey: `${deathRecovery.prefix}-trigger-death`,
    }),
    (error) => error?.code === 'idempotency_conflict',
    'an abandonment trigger key cannot be rebound to cancellation',
  );
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
    [deathRecovery.tool.id],
  ), deathReleaseBefore + 1);
  assert.deepEqual((await pool.query(
    'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',
    [deathRecovery.tool.id],
  )).rows[0], {
    owner_scope: 'account', owner_id: deathRecovery.accounts[2], state: 'active',
  });
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM world_operation_node_state
      WHERE operation_id=$1 AND node_id='reward:belladonna-crew-status'`,
    [deathRecovery.operation.operationId],
  ), 0);

  const crewRecovery = await prepareRecoveryOperation('crew-recovery');
  const otherCrewId = `${crewRecovery.prefix}-other-crew`;
  await pool.query(
    'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
    [otherCrewId, `${crewRecovery.prefix}-other`, crewRecovery.accounts[2]],
  );
  await pool.query(
    'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1',
    [crewRecovery.accounts[2], otherCrewId],
  );
  const crewReleaseBefore = await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
    [crewRecovery.tool.id],
  );
  const canceledOperation = await crewRecovery.act(
    0, cancelOperation, crewRecovery.operation.operationId, {
      idempotencyKey: `${crewRecovery.prefix}-cancel-after-move`,
    },
  );
  assert.equal(canceledOperation.status, 'canceled');
  assert.equal(canceledOperation.releasedEscrowCount, 1);
  assert.deepEqual(await crewRecovery.act(
    0, cancelOperation, crewRecovery.operation.operationId, {
      idempotencyKey: `${crewRecovery.prefix}-cancel-after-move`,
    },
  ), canceledOperation, 'Crew-change cancellation returns custody only once');
  await assert.rejects(
    crewRecovery.act(0, completeOperation, crewRecovery.operation.operationId, {
      idempotencyKey: `${crewRecovery.prefix}-cancel-after-move`,
    }),
    (error) => error?.code === 'idempotency_conflict',
    'a Crew-change cancellation key cannot be rebound to completion',
  );
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'",
    [crewRecovery.tool.id],
  ), crewReleaseBefore + 1);
  assert.deepEqual((await pool.query(
    'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',
    [crewRecovery.tool.id],
  )).rows[0], {
    owner_scope: 'account', owner_id: crewRecovery.accounts[2], state: 'active',
  });
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM world_operation_node_state
      WHERE operation_id=$1 AND node_id='reward:belladonna-crew-status'`,
    [crewRecovery.operation.operationId],
  ), 0);
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:belladonna_artifact'",
  ), rewardsBeforeRecovery, 'death/Crew recovery paths create no Belladonna artifact');

  const finalBalances = await balances();
  assert.deepEqual(finalBalances, afterProduction,
    'mystery, role assignment, evidence, escrow, convergence, and rewards move no cash or OMR');
  assert.equal(await count('SELECT COUNT(*) AS n FROM transactions'), transactionsAtStart + 1,
    'no Belladonna mystery or operation action writes the currency ledger');

  console.log('belladonna ok');
} finally {
  await pool.end();
}
