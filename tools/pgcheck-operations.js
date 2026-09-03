// Real-PostgreSQL-only race probes for the world-graph social-operation runtime.
// Called by tools/pgcheck.js after schema boot. The ordinary pg-mem suite cannot exercise native
// row locks, MVCC visibility, deadlock/lock timeouts, or transaction rollback across separate clients.
import {
  assignRole,
  cancelOperation,
  completeOperation,
  contribute,
  createOperationContext,
  openOperation,
} from '../src/operations.js';
import { dbCaps } from '../src/db.js';
import { createItem, withItemTransaction } from '../src/items.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const ROLES = ['investigator', 'driver', 'mechanic', 'enforcer'];

function allDistinctRoles() {
  return ROLES.map((id) => ({ id, distinct: true }));
}

function operationNodes(rootId, stem, { escrowRoles = [], rewards = true } = {}) {
  const stepIds = ROLES.map((role) => `${stem}:${role}`);
  return [{
    id: rootId,
    type: 'social_gate',
    visibility: 'public',
    minimumDistinctAccounts: 4,
    roles: allDistinctRoles(),
    metadata: {
      phase1Proof: true,
      closerRoleId: 'investigator',
      completionRequires: stepIds,
    },
    effects: rewards ? [
      { adapter: 'unique_item_award', templateId: 'item:pgop_award_a', recipientRoleId: 'investigator' },
      { adapter: 'unique_item_award', templateId: 'item:pgop_award_b', recipientRoleId: 'mechanic' },
    ] : [],
  }, ...ROLES.map((role, index) => ({
    id: stepIds[index],
    type: 'operation_step',
    visibility: role === 'mechanic' ? 'role_private' : 'public',
    requires: [rootId],
    metadata: { operationId: rootId, roleId: role },
    ...(escrowRoles.includes(role) ? {
      conditions: [{ adapter: 'item_ownership', templateId: 'item:pgop_tool' }],
      effects: [{ adapter: 'item_escrow', templateId: 'item:pgop_tool' }],
    } : {}),
  }))];
}

function timeoutPool(pool, { failTerminalUpdate = false } = {}) {
  let terminalFailureUsed = false;
  return {
    async connect() {
      const inner = await pool.connect();
      return new Proxy(inner, {
        get(target, property) {
          if (property === 'query') return async (sql, params) => {
            const result = await target.query(sql, params);
            if (dbCaps.skipLocked && /^\s*BEGIN\s*$/i.test(String(sql))) {
              await target.query("SET LOCAL lock_timeout='3s'");
            }
            if (failTerminalUpdate && !terminalFailureUsed
              && /UPDATE\s+world_operations\s+SET\s+status=/i.test(String(sql))) {
              terminalFailureUsed = true;
              const error = new Error('pgcheck forced terminal rollback');
              error.code = 'pgcheck_forced_rollback';
              throw error;
            }
            return result;
          };
          const value = target[property];
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
}

const fulfilled = (results) => results.filter(({ status }) => status === 'fulfilled').length;
const rejectedWith = (results, codes) => results.filter((result) => (
  result.status === 'rejected' && codes.includes(result.reason?.code)
)).length;

export async function runOperationPgChecks({ pool, check }) {
  const prefix = `pgcheck-operation-runtime-${process.pid}-${Date.now()}`;
  const graphId = `${prefix}-graph`;
  const crewId = `${prefix}-crew`;
  const accounts = Array.from({ length: 5 }, (_, index) => `${prefix}-account-${index}`);
  const characters = Array.from({ length: 5 }, (_, index) => `${prefix}-character-${index}`);
  const roots = {
    left: `${prefix}:left`,
    right: `${prefix}:right`,
    completion: `${prefix}:completion`,
    cancel: `${prefix}:cancel`,
    rollback: `${prefix}:rollback`,
    invalid: `${prefix}:invalid`,
  };
  const graph = loadAndValidateGraphPackages([{
    id: graphId,
    version: 1,
    season: 'core',
    dependsOn: [],
    nodes: [
      {
        id: 'item:pgop_tool', type: 'item_template', visibility: 'hidden',
        metadata: { inventoryClass: 'unique' },
      },
      {
        id: 'item:pgop_award_a', type: 'item_template', visibility: 'hidden',
        metadata: { inventoryClass: 'unique' },
      },
      {
        id: 'item:pgop_award_b', type: 'item_template', visibility: 'hidden',
        metadata: { inventoryClass: 'unique' },
      },
      {
        id: `${prefix}:source`, type: 'source', visibility: 'public',
        produces: [
          { templateId: 'item:pgop_tool', quantity: 1 },
          { templateId: 'item:pgop_award_a', quantity: 1 },
          { templateId: 'item:pgop_award_b', quantity: 1 },
        ],
      },
      ...operationNodes(roots.left, `${prefix}:left-step`, { escrowRoles: ['mechanic'] }),
      ...operationNodes(roots.right, `${prefix}:right-step`, { escrowRoles: ['mechanic'] }),
      ...operationNodes(roots.completion, `${prefix}:completion-step`, {
        escrowRoles: ['investigator', 'mechanic'],
      }),
      ...operationNodes(roots.cancel, `${prefix}:cancel-step`, {
        escrowRoles: ['investigator', 'mechanic'],
      }),
      ...operationNodes(roots.rollback, `${prefix}:rollback-step`, {
        escrowRoles: ['investigator', 'mechanic'],
      }),
      ...operationNodes(roots.invalid, `${prefix}:invalid-step`, { rewards: false }),
    ],
  }]);
  const contexts = accounts.map((accountId) => createOperationContext({ registry: graph, accountId }));
  const boundedPool = timeoutPool(pool);
  const act = (accountIndex, fn, ...args) => withItemTransaction(
    boundedPool, (client) => fn(client, contexts[accountIndex], ...args),
  );
  const key = (suffix) => `${prefix}-${suffix}`;
  const roleAccount = async (operationId, roleId) => (await pool.query(
    `SELECT account_id FROM world_operation_roles WHERE operation_id=$1 AND role_id=$2`,
    [operationId, roleId],
  )).rows[0]?.account_id;
  const accountIndex = (accountId) => accounts.indexOf(accountId);
  const assign = (operationId, roleId, index, suffix) => act(
    index, assignRole, operationId, roleId, { idempotencyKey: key(suffix) },
  );
  const contributeRole = (operation, stem, roleId, index, suffix) => act(
    index, contribute, operation.operationId, `${prefix}:${stem}-step:${roleId}`, {
      idempotencyKey: key(suffix),
    },
  );
  const makeTool = (index, suffix, selectedPool = boundedPool) => withItemTransaction(
    selectedPool, (client) => createItem(
      client, { scope: 'account', id: accounts[index] }, 'item:pgop_tool',
      'crafted', key(suffix),
    ),
  );

  const operationIds = [];
  try {
    await pool.query(
      'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
      [crewId, `${prefix}-crew-name`, accounts[0]],
    );
    for (let index = 0; index < accounts.length; index += 1) {
      await pool.query(
        `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
         VALUES ($1,$2,$3,1,'docks',10000,5000)`,
        [characters[index], accounts[index], `${prefix}-name-${index}`],
      );
      await pool.query(
        'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
        [crewId, accounts[index], `${prefix}-member-${index}`],
      );
    }

    const left = await act(0, openOperation, graphId, roots.left, 1, key('open-left'));
    const right = await act(0, openOperation, graphId, roots.right, 1, key('open-right'));
    const completion = await act(
      0, openOperation, graphId, roots.completion, 1, key('open-completion'),
    );
    const cancel = await act(0, openOperation, graphId, roots.cancel, 1, key('open-cancel'));
    const rollback = await act(0, openOperation, graphId, roots.rollback, 1, key('open-rollback'));
    const invalid = await act(0, openOperation, graphId, roots.invalid, 1, key('open-invalid'));
    operationIds.push(
      left.operationId, right.operationId, completion.operationId, cancel.operationId,
      rollback.operationId, invalid.operationId,
    );

    // Same role, two accounts: the operation row serializes both clients and storage admits one.
    const sameRole = await Promise.allSettled([
      assign(left.operationId, 'investigator', 0, 'left-investigator-a'),
      assign(left.operationId, 'investigator', 4, 'left-investigator-b'),
    ]);
    check(fulfilled(sameRole) === 1 && rejectedWith(sameRole, ['operation_role_taken']) === 1
      && Number((await pool.query(
        `SELECT COUNT(*) AS n FROM world_operation_roles
          WHERE operation_id=$1 AND role_id='investigator'`, [left.operationId],
      )).rows[0].n) === 1,
    'world operation same-role claims serialize across two real PostgreSQL clients',
    sameRole.map((result) => result.status === 'fulfilled' ? 'ok' : result.reason?.code).join(', '));

    // Same account, two roles: the composite UNIQUE rejects the second role under a real race.
    const sameAccount = await Promise.allSettled([
      assign(right.operationId, 'investigator', 0, 'right-account-investigator'),
      assign(right.operationId, 'driver', 0, 'right-account-driver'),
    ]);
    check(fulfilled(sameAccount) === 1
      && rejectedWith(sameAccount, ['operation_distinct_account']) === 1
      && Number((await pool.query(
        'SELECT COUNT(*) AS n FROM world_operation_roles WHERE operation_id=$1 AND account_id=$2',
        [right.operationId, accounts[0]],
      )).rows[0].n) === 1,
    'one account cannot win two roles through separate real PostgreSQL clients',
    sameAccount.map((result) => result.status === 'fulfilled' ? 'ok' : result.reason?.code).join(', '));

    await assign(left.operationId, 'driver', 1, 'left-driver');
    await assign(left.operationId, 'mechanic', 2, 'left-mechanic');
    await assign(left.operationId, 'enforcer', 3, 'left-enforcer');
    const rightOccupied = (await pool.query(
      'SELECT role_id FROM world_operation_roles WHERE operation_id=$1 AND account_id=$2',
      [right.operationId, accounts[0]],
    )).rows[0].role_id;
    await assign(
      right.operationId,
      rightOccupied === 'investigator' ? 'driver' : 'investigator',
      4,
      'right-other-front-role',
    );
    await assign(right.operationId, 'mechanic', 2, 'right-mechanic');
    await assign(right.operationId, 'enforcer', 3, 'right-enforcer');

    // One unique item, two operations: both lock different operations first, then contend on item.
    const sharedTool = await makeTool(2, 'shared-tool');
    const sameItem = await Promise.allSettled([
      contributeRole(left, 'left', 'mechanic', 2, 'left-mechanic-contribution'),
      contributeRole(right, 'right', 'mechanic', 2, 'right-mechanic-contribution'),
    ]);
    const escrow = (await pool.query(
      'SELECT operation_id FROM operation_escrow WHERE item_id=$1', [sharedTool.id],
    )).rows;
    check(fulfilled(sameItem) === 1
      && rejectedWith(sameItem, ['item_unavailable', 'contention']) === 1
      && escrow.length === 1 && operationIds.includes(escrow[0].operation_id),
    'one unique item cannot enter two operations through separate real PostgreSQL clients',
    `${sameItem.map((result) => result.status === 'fulfilled' ? 'ok' : result.reason?.code).join(', ')}; escrow ${escrow.length}`);

    const winner = escrow[0].operation_id === left.operationId ? left : right;
    const winnerStem = winner.operationId === left.operationId ? 'left' : 'right';
    const winnerInvestigator = await roleAccount(winner.operationId, 'investigator');
    const winnerDriver = await roleAccount(winner.operationId, 'driver');
    const winnerEnforcer = await roleAccount(winner.operationId, 'enforcer');
    await contributeRole(
      winner, winnerStem, 'investigator', accountIndex(winnerInvestigator), 'winner-investigator',
    );
    await contributeRole(winner, winnerStem, 'driver', accountIndex(winnerDriver), 'winner-driver');

    // Final contribution and completion race on the same operation row. Completion may win the lock
    // first and report incomplete, or follow the contribution and close; either way one retry closes.
    const finalVsComplete = await Promise.allSettled([
      contributeRole(winner, winnerStem, 'enforcer', accountIndex(winnerEnforcer), 'winner-enforcer'),
      act(accountIndex(winnerInvestigator), completeOperation, winner.operationId, {
        idempotencyKey: key('winner-complete-race'),
      }),
    ]);
    check(fulfilled(finalVsComplete) >= 1
      && fulfilled(finalVsComplete) + rejectedWith(finalVsComplete, ['operation_incomplete']) === 2,
    'final contribution versus completion resolves without a partial terminal state',
    finalVsComplete.map((result) => result.status === 'fulfilled' ? 'ok' : result.reason?.code).join(', '));
    const winnerFinal = await act(
      accountIndex(winnerInvestigator), completeOperation, winner.operationId,
      { idempotencyKey: key('winner-complete-retry') },
    );
    check(winnerFinal.status === 'completed'
      && Number((await pool.query(
        'SELECT COUNT(*) AS n FROM world_operation_contributions WHERE operation_id=$1',
        [winner.operationId],
      )).rows[0].n) === 4,
    'the final-contribution race converges to one complete four-branch state');
    const loser = winner.operationId === left.operationId ? right : left;
    await act(0, cancelOperation, loser.operationId, { idempotencyKey: key('cancel-loser') });

    async function assignCanonical(operation, stem) {
      for (let index = 0; index < ROLES.length; index += 1) {
        await assign(operation.operationId, ROLES[index], index, `${stem}-assign-${ROLES[index]}`);
      }
    }
    async function seedAndContribute(operation, stem, { twoOwners = false } = {}) {
      if (twoOwners) {
        await makeTool(0, `${stem}-investigator-tool`);
        await makeTool(2, `${stem}-mechanic-tool`);
      }
      for (let index = 0; index < ROLES.length; index += 1) {
        await contributeRole(
          operation, stem, ROLES[index], index, `${stem}-contribute-${ROLES[index]}`,
        );
      }
    }

    await assignCanonical(completion, 'completion');
    await seedAndContribute(completion, 'completion', { twoOwners: true });
    const completionAwardsBefore = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    const completionRace = await Promise.allSettled([
      act(0, completeOperation, completion.operationId, { idempotencyKey: key('complete-race-a') }),
      act(0, completeOperation, completion.operationId, { idempotencyKey: key('complete-race-b') }),
    ]);
    const completionAwards = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    check(fulfilled(completionRace) === 2
      && completionAwards - completionAwardsBefore === 2
      && Number((await pool.query(
        'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1',
        [completion.operationId],
      )).rows[0].n) === 0,
    'completion versus completion awards once and releases two owners under native locks',
    `outcomes ${completionRace.map((result) => result.status).join(', ')}, awards delta ${completionAwards - completionAwardsBefore}`);

    await assignCanonical(cancel, 'cancel');
    await seedAndContribute(cancel, 'cancel', { twoOwners: true });
    const cancelVsComplete = await Promise.allSettled([
      act(0, cancelOperation, cancel.operationId, { idempotencyKey: key('cancel-race-cancel') }),
      act(0, completeOperation, cancel.operationId, { idempotencyKey: key('cancel-race-complete') }),
    ]);
    const cancelStatus = (await pool.query(
      'SELECT status FROM world_operations WHERE id=$1', [cancel.operationId],
    )).rows[0]?.status;
    check(['canceled', 'completed'].includes(cancelStatus)
      && fulfilled(cancelVsComplete) === 1
      && rejectedWith(cancelVsComplete, ['operation_closed']) === 1
      && Number((await pool.query(
        'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [cancel.operationId],
      )).rows[0].n) === 0,
    'cancel versus complete chooses one terminal state and returns multi-owner escrow',
    `${cancelStatus}; ${cancelVsComplete.map((result) => result.status === 'fulfilled' ? 'ok' : result.reason?.code).join(', ')}`);

    await assignCanonical(rollback, 'rollback');
    await seedAndContribute(rollback, 'rollback', { twoOwners: true });
    const awardsBeforeRollback = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    let forcedCode = '';
    try {
      await withItemTransaction(timeoutPool(pool, { failTerminalUpdate: true }), (client) => (
        completeOperation(client, contexts[0], rollback.operationId, {
          idempotencyKey: key('forced-terminal-rollback'),
        })
      ));
    } catch (error) { forcedCode = error.code; }
    const rollbackStatus = (await pool.query(
      'SELECT status FROM world_operations WHERE id=$1', [rollback.operationId],
    )).rows[0]?.status;
    const rollbackEscrow = Number((await pool.query(
      'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [rollback.operationId],
    )).rows[0].n);
    const awardsAfterRollback = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    check(forcedCode === 'pgcheck_forced_rollback' && rollbackStatus === 'active'
      && rollbackEscrow === 2 && awardsAfterRollback === awardsBeforeRollback,
    'native rollback restores multi-owner escrow and removes all pre-terminal awards',
    `error ${forcedCode || 'none'}, status ${rollbackStatus}, escrow ${rollbackEscrow}, awards delta ${awardsAfterRollback - awardsBeforeRollback}`);
    await act(0, completeOperation, rollback.operationId, {
      idempotencyKey: key('forced-terminal-retry'),
    });

    await assign(invalid.operationId, 'investigator', 0, 'invalid-investigator');
    await pool.query('UPDATE characters SET alive=false WHERE id=$1', [characters[0]]);
    const invalidated = await assign(
      invalid.operationId, 'driver', 1, 'invalid-trigger-assignment',
    );
    const invalidRoleCount = Number((await pool.query(
      'SELECT COUNT(*) AS n FROM world_operation_roles WHERE operation_id=$1',
      [invalid.operationId],
    )).rows[0].n);
    check(invalidated.status === 'abandoned' && invalidated.closeReason === 'participant_dead'
      && invalidRoleCount === 1,
    'assignment detects a dead pinned participant before admitting another account',
    `status ${invalidated.status}, roles ${invalidRoleCount}`);
    await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characters[0]]);
  } finally {
    // Every fixture uses the unique prefix. Keep the real-Postgres harness re-runnable even after a
    // failed check; deletes are ordered around escrow and provenance FKs.
    const ids = (await pool.query(
      'SELECT id FROM world_operations WHERE graph_id=$1', [graphId],
    )).rows.map(({ id }) => id);
    if (ids.length) {
      await pool.query('DELETE FROM operation_escrow WHERE operation_id = ANY($1::text[])', [ids]);
    }
    await pool.query('DELETE FROM item_events WHERE idempotency_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM item_instances WHERE owner_id = ANY($1::text[])', [
      [...accounts, ...ids],
    ]);
    await pool.query('DELETE FROM item_mutation_guards WHERE idempotency_key LIKE $1', [`${prefix}%`]);
    if (ids.length) {
      await pool.query(
        'DELETE FROM world_operation_contributions WHERE operation_id = ANY($1::text[])', [ids],
      );
      await pool.query(
        'DELETE FROM world_operation_node_state WHERE operation_id = ANY($1::text[])', [ids],
      );
      await pool.query(
        'DELETE FROM world_operation_roles WHERE operation_id = ANY($1::text[])', [ids],
      );
    }
    await pool.query('DELETE FROM world_operations WHERE graph_id=$1', [graphId]);
    await pool.query('DELETE FROM crew_members WHERE crew_id=$1', [crewId]);
    await pool.query('DELETE FROM crews WHERE id=$1', [crewId]);
    await pool.query('DELETE FROM characters WHERE id = ANY($1::text[])', [characters]);
  }
}
