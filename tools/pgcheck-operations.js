// Real-PostgreSQL-only race probes for the world-graph social-operation runtime.
// Called by tools/pgcheck.js after schema boot. The ordinary pg-mem suite cannot exercise native
// row locks, MVCC visibility, deadlock/lock timeouts, or transaction rollback across separate clients.
import crypto from 'node:crypto';
import {
  assignRole,
  cancelOperation,
  completeOperation,
  contribute,
  createOperationContext,
  openOperation,
} from '../src/operations.js';
import { dbCaps } from '../src/db.js';
import { bumpCrewObjective, withCharacter } from '../src/game.js';
import {
  agentActionLockHooks,
  CREW_FIRST_CHARACTER_LOCKS,
  leaveCrew,
  setRecruiting,
} from '../src/crew.js';
import { createItem, withItemTransaction } from '../src/items.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { weekOf } from '../src/rules.js';

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
    query: (...args) => pool.query(...args),
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

function trackedTimeoutPool(pool) {
  let signalPid;
  const pid = new Promise((resolve) => { signalPid = resolve; });
  return {
    pid,
    pool: {
      query: (...args) => pool.query(...args),
      async connect() {
        const inner = await pool.connect();
        return new Proxy(inner, {
          get(target, property) {
            if (property === 'query') return async (sql, params) => {
              const result = await target.query(sql, params);
              if (/^\s*BEGIN\s*$/i.test(String(sql))) {
                await target.query("SET LOCAL lock_timeout='3s'");
                signalPid(Number((await target.query(
                  'SELECT pg_backend_pid() AS pid',
                )).rows[0].pid));
              }
              return result;
            };
            const value = target[property];
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    },
  };
}

function pausedOpenCrewPool(pool) {
  let signalLocked;
  let releaseLock;
  let crewLocked = false;
  let paused = false;
  const locked = new Promise((resolve) => { signalLocked = resolve; });
  const released = new Promise((resolve) => { releaseLock = resolve; });
  const tracked = trackedTimeoutPool(pool);
  return {
    locked,
    pid: tracked.pid,
    release: () => releaseLock(),
    pool: {
      query: (...args) => tracked.pool.query(...args),
      async connect() {
        const inner = await tracked.pool.connect();
        return new Proxy(inner, {
          get(target, property) {
            if (property === 'query') return async (sql, params) => {
              if (crewLocked && !paused) {
                paused = true;
                signalLocked();
                await released;
              }
              const result = await target.query(sql, params);
              if (/FROM\s+crews\s+WHERE\s+id=\$1\s+FOR (?:NO KEY )?UPDATE/i.test(String(sql))) {
                crewLocked = true;
              }
              return result;
            };
            const value = target[property];
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    },
  };
}

function pausedAuthorityPool(pool) {
  let signalLocked;
  let releaseLocks;
  let paused = false;
  let membershipLockSeen = false;
  const locked = new Promise((resolve) => { signalLocked = resolve; });
  const released = new Promise((resolve) => { releaseLocks = resolve; });
  const tracked = trackedTimeoutPool(pool);
  return {
    locked,
    pid: tracked.pid,
    release: () => releaseLocks(),
    pool: {
      query: (...args) => tracked.pool.query(...args),
      async connect() {
        const inner = await tracked.pool.connect();
        return new Proxy(inner, {
          get(target, property) {
            if (property === 'query') return async (sql, params) => {
              const membershipLock = /FROM\s+crew_members\s+WHERE\s+account_id=\$1\s+FOR UPDATE/i
                .test(String(sql));
              // Each participant membership is locked with one static/preparable statement in
              // sorted account order. Pause at the first query *after* that loop, which proves all
              // bounded participant-authority rows are locked without relying on generated IN SQL.
              if (membershipLockSeen && !membershipLock && !paused) {
                paused = true;
                signalLocked();
                await released;
              }
              const result = await target.query(sql, params);
              if (membershipLock) membershipLockSeen = true;
              return result;
            };
            const value = target[property];
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    },
  };
}

async function beginConcurrentWrite(pool, sql, params) {
  const client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='3s'");
  const pid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  let settled = false;
  const finished = (async () => {
    try {
      const result = await client.query(sql, params);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      settled = true;
      client.release();
    }
  })();
  return { pid, finished, settled: () => settled };
}

const shortDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBlockers(pool, pids, expectedBlockerPid, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const blocked = await Promise.all(pids.map(async (pid) => {
      const blockers = (await pool.query(
        'SELECT pg_blocking_pids($1) AS pids', [pid],
      )).rows[0].pids || [];
      return blockers.map(Number).includes(Number(expectedBlockerPid));
    }));
    if (blocked.every(Boolean)) return true;
    await shortDelay(20);
  }
  return false;
}

const fulfilled = (results) => results.filter(({ status }) => status === 'fulfilled').length;
const rejectedWith = (results, codes) => results.filter((result) => (
  result.status === 'rejected' && codes.includes(result.reason?.code)
)).length;

export async function runOperationPgChecks({ pool, check }) {
  const prefix = `pgcheck-operation-runtime-${process.pid}-${Date.now()}`;
  const graphId = `${prefix}-graph`;
  const crewId = `${prefix}-crew`;
  const otherCrewId = `${prefix}-other-crew`;
  // Real gameplay account/character ids are UUID strings. Using prefix-shaped fixture ids made the
  // legacy loadOwned union fail at UUID comparison sites before the intended operation race ran.
  const accounts = Array.from({ length: 5 }, () => crypto.randomUUID());
  const characters = Array.from({ length: 5 }, () => crypto.randomUUID());
  const roots = {
    left: `${prefix}:left`,
    right: `${prefix}:right`,
    completion: `${prefix}:completion`,
    cancel: `${prefix}:cancel`,
    rollback: `${prefix}:rollback`,
    invalid: `${prefix}:invalid`,
    invalidCrew: `${prefix}:invalid-crew`,
    authority: `${prefix}:authority`,
    openLeaveAfter: `${prefix}:open-leave-after`,
    openLeaveBefore: `${prefix}:open-leave-before`,
    openObjective: `${prefix}:open-objective`,
    openRecruiting: `${prefix}:open-recruiting`,
    beforeDeath: `${prefix}:before-death`,
    beforeCrew: `${prefix}:before-crew`,
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
      ...operationNodes(roots.invalidCrew, `${prefix}:invalid-crew-step`, { rewards: false }),
      ...operationNodes(roots.authority, `${prefix}:authority-step`, { rewards: false }),
      ...operationNodes(roots.openLeaveAfter, `${prefix}:open-leave-after-step`, { rewards: false }),
      ...operationNodes(roots.openLeaveBefore, `${prefix}:open-leave-before-step`, { rewards: false }),
      ...operationNodes(roots.openObjective, `${prefix}:open-objective-step`, { rewards: false }),
      ...operationNodes(roots.openRecruiting, `${prefix}:open-recruiting-step`, { rewards: false }),
      ...operationNodes(roots.beforeDeath, `${prefix}:before-death-step`, {
        escrowRoles: ['investigator', 'mechanic'],
      }),
      ...operationNodes(roots.beforeCrew, `${prefix}:before-crew-step`, {
        escrowRoles: ['investigator', 'mechanic'],
      }),
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
  const raceAfterAuthorityLocks = async (label, action, writes) => {
    const paused = pausedAuthorityPool(pool);
    const actionPromise = withItemTransaction(paused.pool, action);
    const reached = await Promise.race([
      paused.locked.then(() => true),
      shortDelay(3000).then(() => false),
    ]);
    if (!reached) {
      paused.release();
      await actionPromise.catch(() => {});
      throw new Error(`${label}: operation never reached the participant authority lock boundary`);
    }
    const actionPid = await paused.pid;
    const writers = await Promise.all(writes.map(({ sql, params }) => (
      beginConcurrentWrite(pool, sql, params)
    )));
    const waited = await waitForBlockers(
      pool, writers.map(({ pid }) => pid), actionPid,
    );
    check(waited, `${label} waits behind the participant authority boundary`,
      `operation pid ${actionPid}, writer pids: ${writers.map(({ pid }) => pid).join(', ')}`);
    paused.release();
    const [result, writeResults] = await Promise.all([
      actionPromise,
      Promise.all(writers.map(({ finished }) => finished)),
    ]);
    check(writeResults.every(({ rowCount }) => rowCount === 1),
      `${label} invalidation commits only after the valid operation action`,
      `row counts: ${writeResults.map(({ rowCount }) => rowCount).join(', ')}`);
    return result;
  };

  const operationIds = [];
  try {
    await pool.query(
      'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
      [crewId, `${prefix}-crew-name`, accounts[0]],
    );
    await pool.query(
      'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
      [otherCrewId, `${prefix}-other-crew-name`, accounts[4]],
    );
    for (let index = 0; index < accounts.length; index += 1) {
      await pool.query(
        'INSERT INTO account_persistent (account_id) VALUES ($1)', [accounts[index]],
      );
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
    const invalidCrew = await act(
      0, openOperation, graphId, roots.invalidCrew, 1, key('open-invalid-crew'),
    );
    operationIds.push(
      left.operationId, right.operationId, completion.operationId, cancel.operationId,
      rollback.operationId, invalid.operationId, invalidCrew.operationId,
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

    if (dbCaps.skipLocked) {
      // OPEN versus LEAVE, forward order: opening holds the Crew row before touching character
      // authority. The production Crew-first wrapper must wait on Crew rather than seize character
      // and form an ABBA cycle.
      const pausedOpen = pausedOpenCrewPool(pool);
      const openAfterPromise = withItemTransaction(pausedOpen.pool, (client) => openOperation(
        client, contexts[4], graphId, roots.openLeaveAfter, 1, key('open-leave-after'),
      ));
      await pausedOpen.locked;
      const trackedLeave = trackedTimeoutPool(pool);
      const leavePromise = withCharacter(
        trackedLeave.pool, accounts[4],
        (character, client, helpers) => leaveCrew(character, client, helpers),
        CREW_FIRST_CHARACTER_LOCKS,
      );
      const openPid = await pausedOpen.pid;
      const leavePid = await trackedLeave.pid;
      const leaveBlocked = await waitForBlockers(pool, [leavePid], openPid);
      check(leaveBlocked, 'production Crew leave waits behind operation opening at the Crew boundary',
        `open pid ${openPid}, leave pid ${leavePid}`);
      pausedOpen.release();
      const [openAfter, leaveAfter] = await Promise.all([openAfterPromise, leavePromise]);
      operationIds.push(openAfter.operationId);
      check(openAfter.status === 'forming' && leaveAfter.crew === 'left',
        'open then leave converge without a deadlock or split authority');
      await pool.query(
        'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
        [crewId, accounts[4], `${prefix}-member-4`],
      );

      // Reverse order: a committed production leave removes the only membership authority before
      // opening begins, so opening refuses and cannot create the second operation.
      await withCharacter(
        boundedPool, accounts[4],
        (character, client, helpers) => leaveCrew(character, client, helpers),
        CREW_FIRST_CHARACTER_LOCKS,
      );
      let reverseOpenCode = '';
      try {
        await act(4, openOperation, graphId, roots.openLeaveBefore, 1, key('open-leave-before'));
      } catch (error) { reverseOpenCode = error.code; }
      const reverseOpenCount = Number((await pool.query(
        'SELECT COUNT(*) AS n FROM world_operations WHERE graph_id=$1 AND operation_node_id=$2',
        [graphId, roots.openLeaveBefore],
      )).rows[0].n);
      check(reverseOpenCode === 'no_crew' && reverseOpenCount === 0,
        'leave ordered before open rejects without inserting an operation',
        `error ${reverseOpenCode || 'none'}, operations ${reverseOpenCount}`);
      await pool.query(
        'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
        [crewId, accounts[4], `${prefix}-member-4`],
      );

      // A normal character-held objective completion must not acquire the Crew row. Hold Crew in
      // an opening transaction, then prove the gameplay transaction finishes before opening is
      // released. The historical denormalized Crew update would block here and complete the ABBA
      // cycle once opening attempted to lock this same character.
      const objectiveWeek = weekOf();
      const pausedObjectiveOpen = pausedOpenCrewPool(pool);
      const objectiveOpenPromise = withItemTransaction(
        pausedObjectiveOpen.pool,
        (client) => openOperation(
          client, contexts[4], graphId, roots.openObjective, 1, key('open-objective'),
        ),
      );
      await pausedObjectiveOpen.locked;
      const trackedObjective = trackedTimeoutPool(pool);
      const objectivePromise = withCharacter(
        trackedObjective.pool, accounts[4],
        (character, client, helpers) => bumpCrewObjective(
          client, helpers, character,
          { crimes: 1000000, kills: 1000000, earn: 1000000000 },
        ),
      );
      const objectivePid = await trackedObjective.pid;
      const objectiveBeforeRelease = await Promise.race([
        objectivePromise.then(
          (value) => ({ settled: true, value }),
          (error) => ({ settled: true, error }),
        ),
        shortDelay(2000).then(() => ({ settled: false })),
      ]);
      let objectiveBlockers = [];
      if (!objectiveBeforeRelease.settled) {
        objectiveBlockers = (await pool.query(
          'SELECT pg_blocking_pids($1) AS pids', [objectivePid],
        )).rows[0].pids || [];
      }
      check(objectiveBeforeRelease.settled && !objectiveBeforeRelease.error
        && objectiveBlockers.length === 0,
        'objective completion finishes while operation opening holds the Crew row',
        `objective pid ${objectivePid}, blockers ${objectiveBlockers.join(', ') || 'none'}, error ${objectiveBeforeRelease.error?.code || 'none'}`);
      pausedObjectiveOpen.release();
      const [objectiveOpen, objectiveResult] = await Promise.all([
        objectiveOpenPromise, objectivePromise,
      ]);
      operationIds.push(objectiveOpen.operationId);
      const objectiveState = (await pool.query(
        'SELECT progress,done FROM crew_objectives WHERE crew_id=$1 AND week=$2',
        [crewId, objectiveWeek],
      )).rows[0];
      const denormalizedCount = Number((await pool.query(
        'SELECT objectives_done AS n FROM crews WHERE id=$1', [crewId],
      )).rows[0].n);
      check(objectiveOpen.status === 'forming' && Number(objectiveResult?.total) > 0
        && Number(objectiveState?.progress) > 0 && objectiveState?.done === true
        && denormalizedCount === 0,
      'objective completion and later open converge without Crew/character inversion',
      `progress ${objectiveState?.progress}, done ${objectiveState?.done}, Crew counter ${denormalizedCount}`);

      // Agent Turn's Crew-recruiting dispatcher uses the same server-authored action-id selector as
      // production. It must wait on Crew before it can acquire the leader character.
      const pausedRecruitingOpen = pausedOpenCrewPool(pool);
      const recruitingOpenPromise = withItemTransaction(
        pausedRecruitingOpen.pool,
        (client) => openOperation(
          client, contexts[0], graphId, roots.openRecruiting, 1, key('open-recruiting'),
        ),
      );
      await pausedRecruitingOpen.locked;
      const recruitingActionId = `organization:crew:${crewId}:recruiting:open`;
      const trackedRecruiting = trackedTimeoutPool(pool);
      const recruitingPromise = withCharacter(
        trackedRecruiting.pool, accounts[0],
        (character, client, helpers) => setRecruiting(character, true, client, helpers),
        agentActionLockHooks(recruitingActionId),
      );
      const recruitingOpenPid = await pausedRecruitingOpen.pid;
      const recruitingPid = await trackedRecruiting.pid;
      const recruitingBlocked = await waitForBlockers(
        pool, [recruitingPid], recruitingOpenPid,
      );
      check(recruitingBlocked,
        'Agent Turn Crew recruiting waits behind opening at the Crew-first boundary',
        `open pid ${recruitingOpenPid}, recruiting pid ${recruitingPid}`);
      pausedRecruitingOpen.release();
      const [recruitingOpen, recruitingResult] = await Promise.all([
        recruitingOpenPromise, recruitingPromise,
      ]);
      operationIds.push(recruitingOpen.operationId);
      const recruitingState = (await pool.query(
        'SELECT recruiting FROM crews WHERE id=$1', [crewId],
      )).rows[0]?.recruiting;
      check(recruitingOpen.status === 'forming' && recruitingResult?.crew === 'recruiting'
        && recruitingState === true,
      'Agent Turn recruiting and operation opening converge without Crew/character inversion');

      const authority = await act(
        0, openOperation, graphId, roots.authority, 1, key('open-authority'),
      );
      operationIds.push(authority.operationId);

      // Existing open versus operation mutation: the open takes Crew then waits on operation; it
      // cannot hold a character needed by the mutation that owns the operation lock.
      const pausedAdmission = pausedAuthorityPool(pool);
      const firstAdmissionPromise = withItemTransaction(
        pausedAdmission.pool,
        (client) => assignRole(client, contexts[0], authority.operationId, 'investigator', {
          idempotencyKey: key('authority-assign-investigator'),
        }),
      );
      await pausedAdmission.locked;
      const trackedExistingOpen = trackedTimeoutPool(pool);
      const existingOpenPromise = withItemTransaction(
        trackedExistingOpen.pool,
        (client) => openOperation(
          client, contexts[0], graphId, roots.authority, 1, key('open-authority-existing'),
        ),
      );
      const admissionPid = await pausedAdmission.pid;
      const existingOpenPid = await trackedExistingOpen.pid;
      const existingOpenBlocked = await waitForBlockers(
        pool, [existingOpenPid], admissionPid,
      );
      check(existingOpenBlocked,
        'existing open waits on operation before acquiring participant character authority',
        `admission pid ${admissionPid}, open pid ${existingOpenPid}`);
      pausedAdmission.release();
      const [firstAdmission, existingOpen] = await Promise.all([
        firstAdmissionPromise, existingOpenPromise,
      ]);
      check(firstAdmission.assignment.roleId === 'investigator'
        && existingOpen.operationId === authority.operationId,
      'existing open and role admission converge without deadlock');

      await raceAfterAuthorityLocks(
        'role admission versus character death',
        (client) => assignRole(client, contexts[1], authority.operationId, 'driver', {
          idempotencyKey: key('authority-assign-driver'),
        }),
        [{ sql: 'UPDATE characters SET alive=false WHERE id=$1', params: [characters[1]] }],
      );
      await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characters[1]]);
      await raceAfterAuthorityLocks(
        'role admission versus Crew membership deletion',
        (client) => assignRole(client, contexts[2], authority.operationId, 'mechanic', {
          idempotencyKey: key('authority-assign-mechanic'),
        }),
        [{ sql: 'DELETE FROM crew_members WHERE account_id=$1', params: [accounts[2]] }],
      );
      await pool.query(
        'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
        [crewId, accounts[2], `${prefix}-member-2`],
      );
      await assign(authority.operationId, 'enforcer', 3, 'authority-assign-enforcer');

      await raceAfterAuthorityLocks(
        'contribution versus character death',
        (client) => contribute(
          client, contexts[0], authority.operationId, `${prefix}:authority-step:investigator`,
          { idempotencyKey: key('authority-contribute-investigator') },
        ),
        [{ sql: 'UPDATE characters SET alive=false WHERE id=$1', params: [characters[0]] }],
      );
      await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characters[0]]);
      await raceAfterAuthorityLocks(
        'contribution versus Crew membership movement',
        (client) => contribute(
          client, contexts[1], authority.operationId, `${prefix}:authority-step:driver`,
          { idempotencyKey: key('authority-contribute-driver') },
        ),
        [{
          sql: 'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1',
          params: [accounts[1], otherCrewId],
        }],
      );
      await pool.query(
        'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [accounts[1], crewId],
      );
      await contributeRole(authority, 'authority', 'mechanic', 2, 'authority-contribute-mechanic');
      await contributeRole(authority, 'authority', 'enforcer', 3, 'authority-contribute-enforcer');

      const terminalRace = await raceAfterAuthorityLocks(
        'completion versus death and Crew movement',
        (client) => completeOperation(client, contexts[0], authority.operationId, {
          idempotencyKey: key('authority-complete'),
        }),
        [
          { sql: 'UPDATE characters SET alive=false WHERE id=$1', params: [characters[2]] },
          {
            sql: 'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1',
            params: [accounts[3], otherCrewId],
          },
        ],
      );
      check(terminalRace.status === 'completed',
        'completion commits atomically before waiting participant invalidations');
      await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characters[2]]);
      await pool.query(
        'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [accounts[3], crewId],
      );
    }

    // Reverse ordering for terminal convergence: invalidation commits first, so completion must
    // abandon, create no awards, and return both owners' escrow.
    const beforeDeath = await act(
      0, openOperation, graphId, roots.beforeDeath, 1, key('open-before-death'),
    );
    operationIds.push(beforeDeath.operationId);
    await assignCanonical(beforeDeath, 'before-death');
    await seedAndContribute(beforeDeath, 'before-death', { twoOwners: true });
    const deathAwardsBefore = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    await pool.query('UPDATE characters SET alive=false WHERE id=$1', [characters[1]]);
    const beforeDeathResult = await act(0, completeOperation, beforeDeath.operationId, {
      idempotencyKey: key('complete-after-death'),
    });
    const deathAwardsAfter = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    check(beforeDeathResult.status === 'abandoned'
      && beforeDeathResult.closeReason === 'participant_dead'
      && beforeDeathResult.releasedEscrowCount === 2
      && deathAwardsAfter === deathAwardsBefore,
    'death committed before completion abandons with full recovery and no awards');
    await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characters[1]]);

    const beforeCrew = await act(
      0, openOperation, graphId, roots.beforeCrew, 1, key('open-before-crew'),
    );
    operationIds.push(beforeCrew.operationId);
    await assignCanonical(beforeCrew, 'before-crew');
    await seedAndContribute(beforeCrew, 'before-crew', { twoOwners: true });
    const crewAwardsBefore = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    await pool.query(
      'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [accounts[1], otherCrewId],
    );
    const beforeCrewResult = await act(0, completeOperation, beforeCrew.operationId, {
      idempotencyKey: key('complete-after-crew-change'),
    });
    const crewAwardsAfter = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_instances
        WHERE template_id IN ('item:pgop_award_a','item:pgop_award_b')
          AND owner_id = ANY($1::text[])`, [accounts],
    )).rows[0].n);
    check(beforeCrewResult.status === 'abandoned'
      && beforeCrewResult.closeReason === 'crew_changed'
      && beforeCrewResult.releasedEscrowCount === 2
      && crewAwardsAfter === crewAwardsBefore,
    'Crew change committed before completion abandons with full recovery and no awards');
    await pool.query(
      'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [accounts[1], crewId],
    );

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
    'death committed before admission abandons before another account is inserted',
    `status ${invalidated.status}, roles ${invalidRoleCount}`);
    await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characters[0]]);

    await assign(invalidCrew.operationId, 'investigator', 0, 'invalid-crew-investigator');
    await pool.query(
      'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [accounts[0], otherCrewId],
    );
    const invalidatedCrew = await assign(
      invalidCrew.operationId, 'driver', 1, 'invalid-crew-trigger-assignment',
    );
    const invalidCrewRoleCount = Number((await pool.query(
      'SELECT COUNT(*) AS n FROM world_operation_roles WHERE operation_id=$1',
      [invalidCrew.operationId],
    )).rows[0].n);
    check(invalidatedCrew.status === 'abandoned' && invalidatedCrew.closeReason === 'crew_changed'
      && invalidCrewRoleCount === 1,
    'Crew change committed before admission abandons before another account is inserted',
    `status ${invalidatedCrew.status}, roles ${invalidCrewRoleCount}`);
    await pool.query(
      'UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [accounts[0], crewId],
    );
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
    await pool.query('DELETE FROM crews WHERE id=$1', [otherCrewId]);
    await pool.query('DELETE FROM characters WHERE id = ANY($1::text[])', [characters]);
    await pool.query('DELETE FROM account_persistent WHERE account_id = ANY($1::text[])', [accounts]);
  }
}
