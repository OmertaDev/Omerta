// Phase 1 four-account social operations: server-derived Crew authority, account-distinct roles,
// asymmetric evidence, ordered contributions, conserved escrow, convergence, and closed-state safety.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { createItem, inventoryBoard, withItemTransaction } from '../src/items.js';
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
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const ACCOUNTS = ['op-account-1', 'op-account-2', 'op-account-3', 'op-account-4'];
const CHARACTERS = ['op-character-1', 'op-character-2', 'op-character-3', 'op-character-4'];
const ROLES = ['investigator', 'driver', 'mechanic', 'enforcer'];
const GRAPH_ID = 'test-social-operation';
const CREW_ID = 'internal-crew-never-publish';

const roles = () => ROLES.map((id) => Object.freeze({
  id, distinct: true,
  ...(id === 'mechanic' ? { conditions: Object.freeze([
    Object.freeze({ adapter: 'skill', skillId: 'fence_network' }),
  ]) } : {}),
}));

const core = Object.freeze({
  id: 'test-operation-core', version: 1, season: 'core', dependsOn: Object.freeze([]),
  nodes: Object.freeze([
    Object.freeze({
      id: 'item:operation_tool', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:missing_operation_tool', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:operation_artifact', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'source:operation_items', type: 'source', visibility: 'public',
      produces: Object.freeze([
        Object.freeze({ templateId: 'item:operation_tool', quantity: 1 }),
        Object.freeze({ templateId: 'item:missing_operation_tool', quantity: 1 }),
        Object.freeze({ templateId: 'item:operation_artifact', quantity: 1 }),
      ]),
    }),
  ]),
});

const mainSteps = Object.freeze([
  Object.freeze({
    id: 'op:investigate', type: 'operation_step', visibility: 'role_private',
    requires: Object.freeze(['op:lockbox']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'investigator', order: 1 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'explicit_interaction', interactionId: 'read_cipher' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:investigator' }),
    ]),
  }),
  Object.freeze({
    id: 'op:mechanic', type: 'operation_step', visibility: 'role_private',
    requires: Object.freeze(['op:lockbox', 'op:investigate']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'mechanic', order: 2 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:operation_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:operation_tool' }),
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:mechanic' }),
    ]),
  }),
  Object.freeze({
    id: 'op:drive', type: 'operation_step', visibility: 'public',
    requires: Object.freeze(['op:lockbox', 'op:mechanic']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'driver', order: 3 }),
  }),
  Object.freeze({
    id: 'op:enforce', type: 'operation_step', visibility: 'public',
    requires: Object.freeze(['op:lockbox', 'op:drive']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'enforcer', order: 4 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:operation_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:operation_tool' }),
    ]),
  }),
  Object.freeze({
    id: 'op:rollback', type: 'operation_step', visibility: 'role_private',
    requires: Object.freeze(['op:lockbox']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'mechanic' }),
    effects: Object.freeze([
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:rollback' }),
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:missing_operation_tool' }),
    ]),
  }),
]);

const deathSteps = Object.freeze(ROLES.map((roleId, index) => Object.freeze({
  id: `death:${roleId}`, type: 'operation_step',
  visibility: roleId === 'mechanic' ? 'role_private' : 'public',
  requires: Object.freeze(['op:death-test']),
  metadata: Object.freeze({ operationId: 'op:death-test', roleId, order: index + 1 }),
  ...(roleId === 'investigator' ? {
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:operation_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:operation_tool' }),
    ]),
  } : {}),
})));

const social = Object.freeze({
  id: GRAPH_ID, version: 1, season: 'core', dependsOn: Object.freeze(['test-operation-core']),
  nodes: Object.freeze([
    Object.freeze({
      id: 'op:lockbox', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        completionRequires: Object.freeze(['op:investigate', 'op:mechanic', 'op:drive', 'op:enforce']),
      }),
      effects: Object.freeze([
        Object.freeze({
          adapter: 'unique_item_award', templateId: 'item:operation_artifact',
          recipientRoleId: 'investigator',
        }),
        Object.freeze({ adapter: 'status_award', nodeId: 'reward:operation_status' }),
      ]),
    }),
    ...mainSteps,
    Object.freeze({
      id: 'evidence:investigator', type: 'evidence', visibility: 'role_private',
      metadata: Object.freeze({ roleId: 'investigator', secret: 'violet ledger' }),
    }),
    Object.freeze({
      id: 'evidence:mechanic', type: 'evidence', visibility: 'role_private',
      metadata: Object.freeze({ roleId: 'mechanic', secret: 'reversed tumblers' }),
    }),
    Object.freeze({
      id: 'evidence:rollback', type: 'evidence', visibility: 'role_private',
      metadata: Object.freeze({ roleId: 'mechanic', secret: 'must roll back' }),
    }),
    Object.freeze({
      id: 'reward:operation_status', type: 'reward', visibility: 'hidden', repeatability: 'once',
      metadata: Object.freeze({ inert: true, rewardType: 'status', title: 'Lockbox Witness' }),
    }),
    Object.freeze({
      id: 'op:death-test', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        completionRequires: Object.freeze(ROLES.map((roleId) => `death:${roleId}`)),
      }),
    }),
    ...deathSteps,
    Object.freeze({
      id: 'op:cancel-test', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        completionRequires: Object.freeze(ROLES.map((roleId) => `cancel:${roleId}`)),
      }),
    }),
    ...ROLES.map((roleId, index) => Object.freeze({
      id: `cancel:${roleId}`, type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:cancel-test']),
      metadata: Object.freeze({ operationId: 'op:cancel-test', roleId, order: index + 1 }),
    })),
  ]),
});

const registry = loadAndValidateGraphPackages([core, social]);
assert.throws(
  () => createOperationContext({
    registry: Object.freeze({ byPackage: new Map(), nodes: new Map() }),
    accountId: ACCOUNTS[0],
  }),
  (error) => error?.code === 'bad_operation_context',
  'a frozen wrapper around caller-mutable Maps cannot forge graph authority',
);
const contexts = ACCOUNTS.map((accountId) => createOperationContext({
  registry, accountId, now: '2026-09-03T20:00:00.000Z',
}));
const pool = await makeDb();
const tx = (action) => withItemTransaction(pool, action);
const act = (index, fn, ...args) => tx((client) => fn(client, contexts[index], ...args));
const count = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);
const safeJson = (value) => JSON.stringify(value);

try {
  await pool.query(
    `INSERT INTO crews (id,name,leader_account) VALUES ($1,'Operation Crew',$2)`,
    [CREW_ID, ACCOUNTS[0]],
  );
  for (let index = 0; index < ACCOUNTS.length; index += 1) {
    await pool.query(
      `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
       VALUES ($1,$2,$3,1,'docks',10000,$4)`,
      [CHARACTERS[index], ACCOUNTS[index], `Operator ${index + 1}`, 7000 + index],
    );
    await pool.query(
      'INSERT INTO account_persistent (account_id,omr) VALUES ($1,$2)',
      [ACCOUNTS[index], 900 + index],
    );
    await pool.query(
      'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
      [CREW_ID, ACCOUNTS[index], `Operator ${index + 1}`],
    );
  }
  await pool.query(
    "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network')",
    [CHARACTERS[2]],
  );

  const moneyBefore = await Promise.all(ACCOUNTS.map(async (accountId, index) => ({
    cash: Number((await pool.query(
      'SELECT cash FROM characters WHERE id=$1', [CHARACTERS[index]],
    )).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
    )).rows[0].omr),
  })));
  const transactionsBefore = await count('SELECT COUNT(*) AS n FROM transactions');

  const opened = await act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-main');
  assert.equal(opened.status, 'forming');
  assert(!safeJson(opened).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(opened).includes(id)));

  const firstAssignment = await act(0, assignRole, opened.operationId, 'investigator', {
    idempotencyKey: 'op-assign-investigator',
  });
  assert.equal(firstAssignment.assignment.roleId, 'investigator');
  await assert.rejects(
    act(0, assignRole, opened.operationId, 'driver', { idempotencyKey: 'op-same-account-twice' }),
    (error) => error?.code === 'operation_distinct_account',
  );
  await assert.rejects(
    act(0, contribute, opened.operationId, 'op:investigate', {
      idempotencyKey: 'op-contribute-too-early', interactionId: 'read_cipher',
    }),
    (error) => error?.code === 'operation_not_active',
  );
  await act(1, assignRole, opened.operationId, 'driver', { idempotencyKey: 'op-assign-driver' });
  await act(2, assignRole, opened.operationId, 'mechanic', { idempotencyKey: 'op-assign-mechanic' });
  const activated = await act(3, assignRole, opened.operationId, 'enforcer', {
    idempotencyKey: 'op-assign-enforcer',
  });
  assert.equal(activated.status, 'active');
  assert.equal(await count(
    'SELECT COUNT(DISTINCT account_id) AS n FROM world_operation_roles WHERE operation_id=$1',
    [opened.operationId],
  ), 4, 'storage holds four distinct accounts');

  const publicBefore = await operationBoard(pool, contexts[0], opened.operationId);
  assert.equal(publicBefore.filledRoleCount, 4);
  assert(!safeJson(publicBefore).includes('op:investigate'));
  assert(!safeJson(publicBefore).includes('op:mechanic'));
  assert(!safeJson(publicBefore).includes('evidence:investigator'));
  assert(!safeJson(publicBefore).includes('evidence:mechanic'));
  assert(!safeJson(publicBefore).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(publicBefore).includes(id)));

  const investigatorBefore = await roleBoard(pool, contexts[0], opened.operationId);
  assert(investigatorBefore.nodes.some(({ id }) => id === 'op:investigate'));
  assert(!investigatorBefore.nodes.some(({ id }) => id === 'op:mechanic'));
  await assert.rejects(
    act(1, contribute, opened.operationId, 'op:investigate', {
      idempotencyKey: 'op-wrong-role', interactionId: 'read_cipher',
    }),
    (error) => error?.code === 'operation_role_forbidden',
  );
  await assert.rejects(
    act(2, contribute, opened.operationId, 'op:mechanic', {
      idempotencyKey: 'op-out-of-order',
    }),
    (error) => error?.code === 'operation_prerequisite' || error?.code === 'operation_order',
  );

  await act(0, contribute, opened.operationId, 'op:investigate', {
    idempotencyKey: 'op-contribute-investigator', interactionId: 'read_cipher',
  });
  const investigatorPrivate = await roleBoard(pool, contexts[0], opened.operationId);
  assert(investigatorPrivate.nodes.some(({ id }) => id === 'evidence:investigator'));
  assert(!investigatorPrivate.nodes.some(({ id }) => id === 'evidence:mechanic'));
  const mechanicPrivate = await roleBoard(pool, contexts[2], opened.operationId);
  assert(!mechanicPrivate.nodes.some(({ id }) => id === 'evidence:investigator'));
  assert(mechanicPrivate.nodes.some(({ id }) => id === 'op:mechanic'));

  await assert.rejects(
    act(2, contribute, opened.operationId, 'op:mechanic', {
      idempotencyKey: 'op-mechanic-no-item',
    }),
    (error) => error?.code === 'item_unavailable',
  );
  const tool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[2] }, 'item:operation_tool',
    'crafted', 'op-seed-tool-main',
  ));
  const mechanicContribution = await act(2, contribute, opened.operationId, 'op:mechanic', {
    idempotencyKey: 'op-contribute-mechanic',
  });
  assert.equal(mechanicContribution.effects[0].item.state, 'escrowed');
  assert(!safeJson(mechanicContribution).includes(ACCOUNTS[2]));
  await act(2, contribute, opened.operationId, 'op:mechanic', {
    idempotencyKey: 'op-contribute-mechanic',
  });
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [opened.operationId],
  ), 1, 'replay cannot duplicate operation custody');

  await act(1, contribute, opened.operationId, 'op:drive', {
    idempotencyKey: 'op-contribute-driver',
  });
  await assert.rejects(
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'op-complete-early' }),
    (error) => error?.code === 'operation_incomplete',
  );
  const enforcerTool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[3] }, 'item:operation_tool',
    'crafted', 'op-seed-tool-enforcer',
  ));
  await act(3, contribute, opened.operationId, 'op:enforce', {
    idempotencyKey: 'op-contribute-enforcer',
  });

  await assert.rejects(
    act(2, contribute, opened.operationId, 'op:rollback', {
      idempotencyKey: 'op-contribute-rollback',
    }),
    (error) => error?.code === 'item_unavailable',
  );
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM world_operation_node_state WHERE operation_id=$1 AND node_id='evidence:rollback'",
    [opened.operationId],
  ), 0, 'a late failed effect rolls back earlier operation state under pg-mem');

  await assert.rejects(
    act(1, completeOperation, opened.operationId, { idempotencyKey: 'op-wrong-closer' }),
    (error) => error?.code === 'operation_completion_role',
  );
  const [closeOne, closeTwo] = await Promise.all([
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'op-complete-main-a' }),
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'op-complete-main-b' }),
  ]);
  assert.equal(closeOne.status, 'completed');
  assert.equal(closeTwo.status, 'completed');
  assert.equal(closeOne.releasedEscrowCount + closeTwo.releasedEscrowCount, 2);
  assert(!safeJson(closeOne).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(closeOne).includes(id)));
  const investigatorInventory = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[0] });
  assert.equal(investigatorInventory.items.filter(
    ({ templateId }) => templateId === 'item:operation_artifact',
  ).length, 1, 'concurrent completion awards exactly one artifact');
  const mechanicInventory = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[2] });
  assert(mechanicInventory.items.some(({ id, state }) => id === tool.id && state === 'active'),
    'terminal convergence returns contributed escrow to its depositor');
  const enforcerInventory = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[3] });
  assert(enforcerInventory.items.some(({ id, state }) => id === enforcerTool.id && state === 'active'),
    'one operation can conserve and independently return deposits from different participants');
  await assert.rejects(
    act(3, contribute, opened.operationId, 'op:enforce', {
      idempotencyKey: 'op-after-close',
    }),
    (error) => error?.code === 'operation_not_active',
  );

  // A participant death abandons the operation on the next mutation and returns custody atomically.
  const death = await act(0, openOperation, GRAPH_ID, 'op:death-test', 1, 'op-open-death');
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, assignRole, death.operationId, ROLES[index], {
      idempotencyKey: `op-death-assign-${index}`,
    });
  }
  const deathTool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[0] }, 'item:operation_tool',
    'crafted', 'op-seed-tool-death',
  ));
  await act(0, contribute, death.operationId, 'death:investigator', {
    idempotencyKey: 'op-death-contribute-investigator',
  });
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[2]]);
  const abandoned = await act(1, contribute, death.operationId, 'death:driver', {
    idempotencyKey: 'op-trigger-abandonment',
  });
  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.closeReason, 'participant_dead');
  assert.equal(abandoned.releasedEscrowCount, 1);
  const recovered = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[0] });
  assert(recovered.items.some(({ id, state }) => id === deathTool.id && state === 'active'));

  // An opener may cancel a forming run without a living street; closure is exact and replay-safe.
  const cancel = await act(0, openOperation, GRAPH_ID, 'op:cancel-test', 1, 'op-open-cancel');
  const roleRace = await Promise.allSettled([
    act(0, assignRole, cancel.operationId, 'investigator', {
      idempotencyKey: 'op-cancel-role-race-a',
    }),
    act(1, assignRole, cancel.operationId, 'investigator', {
      idempotencyKey: 'op-cancel-role-race-b',
    }),
  ]);
  assert.equal(roleRace.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(roleRace.filter((result) => (
    result.status === 'rejected' && result.reason?.code === 'operation_role_taken'
  )).length, 1, 'concurrent claims cannot occupy one role twice');
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[0]]);
  const canceled = await act(0, cancelOperation, cancel.operationId, {
    idempotencyKey: 'op-cancel-forming',
  });
  assert.equal(canceled.status, 'canceled');
  const canceledReplay = await act(0, cancelOperation, cancel.operationId, {
    idempotencyKey: 'op-cancel-forming',
  });
  assert.deepEqual(canceledReplay, canceled);

  const moneyAfter = await Promise.all(ACCOUNTS.map(async (accountId, index) => ({
    cash: Number((await pool.query(
      'SELECT cash FROM characters WHERE id=$1', [CHARACTERS[index]],
    )).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
    )).rows[0].omr),
  })));
  assert.deepEqual(moneyAfter, moneyBefore, 'operations cannot move cash or OMR');
  assert.equal(await count('SELECT COUNT(*) AS n FROM transactions'), transactionsBefore,
    'operations cannot write the currency ledger');

  console.log('operations ok');
} finally {
  await pool.end();
}
