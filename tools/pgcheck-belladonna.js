// Belladonna's complete Phase 1 vertical slice on a caller-owned database pool.
//
// tools/pgcheck.js invokes this against its real PostgreSQL server pool. Running this file directly
// with `--pg-mem` executes the identical control path in a separate process, avoiding any mutation
// of db.js's process-global database capabilities while a real pool is alive.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { craftWorldGraphRecipe, salvageCar } from '../src/crafting.js';
import { AUTOMOTIVE_SALVAGE_PACKAGE } from '../src/content/automotive-salvage.js';
import { BELLADONNA_PACKAGE } from '../src/content/belladonna.js';
import { CORE_MATERIALS_PACKAGE } from '../src/content/core-materials.js';
import {
  inventoryBoard,
  transferItem,
  withItemTransaction,
} from '../src/items.js';
import { runLedgerInvariants } from '../src/invariants.js';
import {
  completeNode,
  createMysteryContext,
  startMystery,
} from '../src/mysteries.js';
import {
  assignRole,
  completeOperation,
  contribute,
  createOperationContext,
  openOperation,
  roleBoard,
} from '../src/operations.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const ROLES = ['investigator', 'driver', 'mechanic', 'enforcer'];
const GRAPH_ID = 'belladonna-demo';
const ROOT_ID = 'operation:belladonna-lockbox';

function forcedTerminalFailurePool(pool) {
  let fired = false;
  return {
    async connect() {
      const inner = await pool.connect();
      return new Proxy(inner, {
        get(target, property) {
          if (property === 'query') return async (sql, params) => {
            const result = await target.query(sql, params);
            if (!fired && /UPDATE\s+world_operations\s+SET\s+status=/i.test(String(sql))) {
              fired = true;
              const error = new Error('Belladonna forced terminal rollback');
              error.code = 'belladonna_forced_rollback';
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

function twoTransactionBarrierPool(pool, backendPids) {
  let arrivals = 0;
  let releaseBarrier;
  const ready = new Promise((resolve) => { releaseBarrier = resolve; });
  return {
    async connect() {
      const inner = await pool.connect();
      return new Proxy(inner, {
        get(target, property) {
          if (property === 'query') return async (sql, params) => {
            const result = await target.query(sql, params);
            if (/^\s*BEGIN\s*$/i.test(String(sql))) {
              await target.query("SET LOCAL lock_timeout='4s'");
              backendPids.push(Number((await target.query(
                'SELECT pg_backend_pid() AS pid',
              )).rows[0].pid));
              arrivals += 1;
              if (arrivals === 2) releaseBarrier();
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                  () => reject(new Error('Belladonna completion barrier timed out')), 5000,
                );
                ready.then(() => {
                  clearTimeout(timeout);
                  resolve();
                }, reject);
              });
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

const stackQty = (board, templateId) => Number(
  board.stacks.find(({ templateId: id }) => id === templateId)?.qty || 0,
);

export async function runBelladonnaPgChecks({
  pool,
  check,
  nativePostgres = true,
  runId = `pgcheck-belladonna-${process.pid}-${Date.now()}-${randomUUID()}`,
}) {
  const prefix = runId.replace(/[^a-zA-Z0-9:_-]/g, '-');
  const accounts = ROLES.map((role) => `${prefix}-${role}-account`);
  const characters = ROLES.map((role) => `${prefix}-${role}-character`);
  const crewId = `${prefix}-crew`;
  const carId = `${prefix}-car`;
  const accountOwner = { scope: 'account', id: accounts[0] };
  const characterOwner = { scope: 'character', id: characters[0] };
  const mechanicOwner = { scope: 'account', id: accounts[2] };
  const registry = loadAndValidateGraphPackages([
    CORE_MATERIALS_PACKAGE,
    AUTOMOTIVE_SALVAGE_PACKAGE,
    BELLADONNA_PACKAGE,
  ]);
  const mysteryContexts = accounts.map((accountId) => createMysteryContext({
    registry, accountId, now: '2026-09-03T20:00:00.000Z',
  }));
  const operationContexts = accounts.map((accountId) => createOperationContext({
    registry, accountId, now: '2026-09-03T20:00:00.000Z',
  }));
  const tx = (action, selectedPool = pool) => withItemTransaction(selectedPool, action);
  const mysteryAct = (fn, ...args) => tx(
    (client) => fn(client, mysteryContexts[0], ...args),
  );
  const operationAct = (index, fn, ...args) => tx(
    (client) => fn(client, operationContexts[index], ...args),
  );
  const n = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);
  const money = async () => Promise.all(accounts.map(async (accountId, index) => ({
    cash: Number((await pool.query(
      'SELECT cash FROM characters WHERE id=$1', [characters[index]],
    )).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
    )).rows[0].omr),
  })));
  let operationId = null;
  let mysteryId = null;
  let toolId = null;
  try {
    await pool.query(
      'INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)',
      [crewId, `${prefix}-name`, accounts[0]],
    );
    for (let index = 0; index < accounts.length; index += 1) {
      await pool.query(
        `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
         VALUES ($1,$2,$3,1,'foundry',10000,10000)`,
        [characters[index], accounts[index], `${prefix}-operator-${index}`],
      );
      await pool.query(
        'INSERT INTO account_persistent (account_id,omr) VALUES ($1,$2)',
        [accounts[index], 800 + index],
      );
      await pool.query(
        'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
        [crewId, accounts[index], `${prefix}-member-${index}`],
      );
    }
    await pool.query(
      `INSERT INTO character_skills (character_id,skill_id)
       VALUES ($1,'fence_network'),($2,'fence_network')`,
      [characters[0], characters[2]],
    );
    await pool.query(
      `INSERT INTO cars
         (id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip)
       VALUES ($1,$2,'junker','stock',61,false,false,false,null,false)`,
      [carId, characters[0]],
    );
    const before = await money();
    const ledgerBefore = await n('SELECT COUNT(*) AS n FROM transactions');
    const identity = { accountId: accounts[0], owned: { cars: [] } };
    const invariantCheck = async (name) => (await runLedgerInvariants(pool, { alert: false }))
      .checks.find((entry) => entry.name === name);
    const carDriftBeforeSalvage = (await invariantCheck('car conservation')).drift;
    const salvageSinksBefore = (await invariantCheck('world graph salvage car audit')).logicalSinks;

    // On PostgreSQL these are two separately checked-out clients contending on the same logical
    // guard and car row. pg-mem runs the same control under its compensation/serialization path.
    const salvages = await Promise.all([
      tx((client) => salvageCar(
        client, identity, carId, 'recipe:car_salvage_basic', `${prefix}-salvage`,
      )),
      tx((client) => salvageCar(
        client, identity, carId, 'recipe:car_salvage_basic', `${prefix}-salvage`,
      )),
    ]);
    let board = await inventoryBoard(pool, accountOwner);
    check(JSON.stringify(salvages[0]) === JSON.stringify(salvages[1])
      && await n('SELECT COUNT(*) AS n FROM cars WHERE id=$1', [carId]) === 0
      && stackQty(board, 'mat:scrap_steel') === 6
      && stackQty(board, 'mat:wire') === 2
      && stackQty(board, 'mat:salvage_parts') === 2,
    'Belladonna same-key salvage consumes one real car into exact graph quantities');
    let secondLogicalCode = '';
    try {
      await tx((client) => salvageCar(
        client, identity, carId, 'recipe:car_salvage_basic', `${prefix}-salvage-second`,
      ));
    } catch (error) { secondLogicalCode = error.code; }
    const salvageAudit = await invariantCheck('world graph salvage car audit');
    const carDriftAfterSalvage = (await invariantCheck('car conservation')).drift;
    check(secondLogicalCode === 'no_car'
        && salvageAudit.ok
        && salvageAudit.logicalSinks === salvageSinksBefore + 1
        && salvageAudit.carIds.includes(carId)
        && carDriftAfterSalvage === carDriftBeforeSalvage,
    'Belladonna salvage, replay, and failed fresh action move held car and one guard sink together',
    `failure ${secondLogicalCode || 'none'}, sinks ${salvageSinksBefore} -> ${salvageAudit.logicalSinks}, drift ${carDriftBeforeSalvage} -> ${carDriftAfterSalvage}`);
    check(await n('SELECT COUNT(*) AS n FROM transactions') === ledgerBefore,
      'Belladonna salvage, replay, and failure create no currency row');

    await tx((client) => craftWorldGraphRecipe(
      client, identity, 'recipe:hardened_steel', `${prefix}-harden`,
    ));
    const crafted = await tx((client) => craftWorldGraphRecipe(
      client, identity, 'recipe:precision_lock_tool', `${prefix}-craft-tool`,
    ));
    toolId = crafted.outputs[0].id;
    board = await inventoryBoard(pool, accountOwner);
    const afterProduction = await money();
    const productionLedger = await n(
      `SELECT COUNT(*) AS n FROM transactions
        WHERE character_id=$1 AND currency='cash' AND amount=-300
          AND reason='craft:recipe:hardened_steel'`,
      [characters[0]],
    );
    check(stackQty(board, 'mat:scrap_steel') === 2
      && stackQty(board, 'mat:wire') === 2
      && stackQty(board, 'mat:salvage_parts') === 0
      && stackQty(board, 'mat:hardened_steel') === 0
      && board.items.filter(({ id }) => id === toolId).length === 1,
    'Belladonna production consumes the exact inputs into one permanent precision tool');
    check(afterProduction[0].cash === before[0].cash - 300
      && afterProduction.slice(1).every(({ cash }, index) => cash === before[index + 1].cash)
      && afterProduction.every(({ omr }, index) => omr === before[index].omr)
      && productionLedger === 1
      && await n('SELECT COUNT(*) AS n FROM transactions') === ledgerBefore + 1,
    'Belladonna production has one $300 cash sink, one ledger row, and zero OMR movement');

    await tx((client) => transferItem(
      client, accountOwner, characterOwner, toolId,
      'pgcheck Belladonna character pin', `${prefix}-to-character`,
    ));
    const started = await mysteryAct(startMystery, characterOwner, GRAPH_ID, 1);
    mysteryId = started.instanceId;
    await mysteryAct(
      completeNode, characterOwner, GRAPH_ID, 'mystery:belladonna-trace', {
        idempotencyKey: `${prefix}-trace`, interactionId: 'inspect_belladonna_stamp',
      },
    );
    await mysteryAct(
      completeNode, characterOwner, GRAPH_ID, 'mystery:belladonna-lock', {
        idempotencyKey: `${prefix}-lock`, interactionId: 'set_precision_tumblers',
      },
    );
    check(await n(
      'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1 AND item_id=$2',
      [mysteryId, toolId],
    ) === 1, 'Belladonna mystery escrows the exact crafted tool under its pinned instance');
    const mysteryClosed = await mysteryAct(
      completeNode, characterOwner, GRAPH_ID, 'mystery:belladonna-file-closed', {
        idempotencyKey: `${prefix}-close-mystery`, interactionId: 'seal_belladonna_file',
      },
    );
    const pinnedMystery = (await pool.query(
      `SELECT owner_scope,owner_id,authority_account_id,graph_version,status
         FROM mystery_instances WHERE id=$1`, [mysteryId],
    )).rows[0];
    check(mysteryClosed.status === 'completed' && mysteryClosed.releasedEscrowCount === 1
      && pinnedMystery?.owner_scope === 'character'
      && pinnedMystery?.owner_id === characters[0]
      && pinnedMystery?.authority_account_id === accounts[0]
      && Number(pinnedMystery?.graph_version) === 1
      && pinnedMystery?.status === 'completed',
    'Belladonna terminal closes the character/account/version-pinned Task 5 bridge');

    const opened = await operationAct(
      0, openOperation, GRAPH_ID, ROOT_ID, 1, `${prefix}-open-operation`,
    );
    operationId = opened.operationId;
    for (let index = 0; index < ROLES.length; index += 1) {
      await operationAct(index, assignRole, operationId, ROLES[index], {
        idempotencyKey: `${prefix}-assign-${ROLES[index]}`,
      });
    }
    check(await n(
      'SELECT COUNT(DISTINCT account_id) AS n FROM world_operation_roles WHERE operation_id=$1',
      [operationId],
    ) === 4, 'Belladonna assigns four distinct accounts under database authority');
    await operationAct(0, contribute, operationId, 'operation:belladonna-investigate', {
      idempotencyKey: `${prefix}-investigate`, interactionId: 'read_belladonna_cipher',
    });
    await operationAct(1, contribute, operationId, 'operation:belladonna-drive', {
      idempotencyKey: `${prefix}-drive`, interactionId: 'stage_belladonna_car',
    });
    await tx((client) => transferItem(
      client, characterOwner, mechanicOwner, toolId,
      'pgcheck Belladonna mechanic handoff', `${prefix}-to-mechanic`,
    ));
    await operationAct(2, contribute, operationId, 'operation:belladonna-mechanic', {
      idempotencyKey: `${prefix}-mechanic`,
    });
    await operationAct(3, contribute, operationId, 'operation:belladonna-enforce', {
      idempotencyKey: `${prefix}-enforce`, interactionId: 'secure_belladonna_room',
    });
    const investigatorBoard = await roleBoard(pool, operationContexts[0], operationId);
    const mechanicBoard = await roleBoard(pool, operationContexts[2], operationId);
    check(investigatorBoard.nodes.find(
      ({ id }) => id === 'evidence:belladonna-cipher-fragment',
    )?.privateEvidence === 'The fourth petal marks the false hinge.'
      && mechanicBoard.nodes.find(
        ({ id }) => id === 'evidence:belladonna-tumbler-pattern',
      )?.privateEvidence === 'The maker reversed the last two gates.',
    'Belladonna delivers two distinct role-private evidence branches');
    check(await n(
      'SELECT COUNT(DISTINCT role_id) AS n FROM world_operation_contributions WHERE operation_id=$1',
      [operationId],
    ) === 4 && await n(
      'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1 AND item_id=$2',
      [operationId, toolId],
    ) === 1, 'Belladonna converges four ordered branches with the mechanic tool in custody');

    // Fail after awards, status, release, and terminal UPDATE have executed. Real PostgreSQL must
    // roll every write back natively; pg-mem must reach the same state through its inverse log.
    const releaseBeforeFailure = await n(
      "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'", [toolId],
    );
    let forcedCode = '';
    try {
      await tx((client) => completeOperation(client, operationContexts[0], operationId, {
        idempotencyKey: `${prefix}-forced-terminal`,
      }), forcedTerminalFailurePool(pool));
    } catch (error) { forcedCode = error.code; }
    const afterForced = (await pool.query(
      'SELECT status,completed_at FROM world_operations WHERE id=$1', [operationId],
    )).rows[0];
    const forcedTool = (await pool.query(
      'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [toolId],
    )).rows[0];
    check(forcedCode === 'belladonna_forced_rollback'
      && afterForced?.status === 'active' && afterForced?.completed_at == null
      && await n(
        "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:belladonna_artifact'"
          + ' AND owner_id = ANY($1::text[])', [accounts],
      ) === 0
      && await n(
        `SELECT COUNT(*) AS n FROM world_operation_node_state
          WHERE operation_id=$1 AND node_id='reward:belladonna-crew-status'`, [operationId],
      ) === 0
      && await n('SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [operationId]) === 1
      && forcedTool?.owner_scope === 'operation' && forcedTool?.owner_id === operationId
      && forcedTool?.state === 'escrowed'
      && await n(
        "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='released'", [toolId],
      ) === releaseBeforeFailure
      && await n(
        'SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1',
        [`${prefix}-forced-terminal`],
      ) === 0,
    `${nativePostgres ? 'native PostgreSQL' : 'pg-mem control'} terminal rollback removes awards, status, release, and guard`);

    const moneyBeforeCompletion = await money();
    const ledgerBeforeCompletion = await n('SELECT COUNT(*) AS n FROM transactions');
    const backendPids = [];
    const completionPool = nativePostgres
      ? twoTransactionBarrierPool(pool, backendPids) : pool;
    const complete = (key) => tx(
      (client) => completeOperation(client, operationContexts[0], operationId, {
        idempotencyKey: key,
      }),
      completionPool,
    );
    const completionOutcomes = await Promise.allSettled([
      complete(`${prefix}-complete-a`),
      complete(`${prefix}-complete-b`),
    ]);
    const completions = completionOutcomes.filter(
      ({ status }) => status === 'fulfilled',
    ).map(({ value }) => value);
    const finalTool = (await pool.query(
      'SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [toolId],
    )).rows[0];
    const toolEvents = (await pool.query(
      `SELECT event_kind,provenance_kind FROM item_events
        WHERE item_id=$1 ORDER BY sequence`, [toolId],
    )).rows;
    check(!nativePostgres || (backendPids.length === 2 && new Set(backendPids).size === 2),
      nativePostgres
        ? 'Belladonna completion race uses two distinct PostgreSQL backends'
        : 'Belladonna pg-mem control executes the same completion race',
      backendPids.join(', '));
    check(completions.length === 2
      && completions.every(({ status }) => status === 'completed')
      && completions.reduce((sum, result) => sum + result.releasedEscrowCount, 0) === 1
      && await n(
        "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:belladonna_artifact'"
          + ' AND owner_scope=\'account\' AND owner_id=$1', [accounts[0]],
      ) === 1
      && await n(
        "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:belladonna_artifact'"
          + ' AND owner_id = ANY($1::text[])', [accounts],
      ) === 1
      && await n(
        `SELECT COUNT(*) AS n FROM world_operation_node_state
          WHERE operation_id=$1 AND node_id='reward:belladonna-crew-status' AND state='completed'`,
        [operationId],
      ) === 1
      && await n('SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [operationId]) === 0
      && finalTool?.owner_scope === 'account' && finalTool?.owner_id === accounts[2]
      && finalTool?.state === 'active',
    'Belladonna concurrent convergence awards one inert artifact/status and returns custody once',
    completionOutcomes.map((outcome) => (
      outcome.status === 'fulfilled' ? 'fulfilled' : `${outcome.reason?.code || 'error'}`
    )).join(', '));
    const finalMoney = await money();
    check(JSON.stringify(finalMoney) === JSON.stringify(afterProduction)
      && JSON.stringify(finalMoney) === JSON.stringify(moneyBeforeCompletion)
      && ledgerBeforeCompletion === ledgerBefore + 1
      && await n('SELECT COUNT(*) AS n FROM transactions') === ledgerBefore + 1,
    'Belladonna mystery and operation add zero cash, OMR, or currency-ledger movement');
    check(JSON.stringify(toolEvents) === JSON.stringify([
      { event_kind: 'created', provenance_kind: 'crafted' },
      { event_kind: 'transferred', provenance_kind: 'transferred' },
      { event_kind: 'escrowed', provenance_kind: 'used_in_mystery' },
      { event_kind: 'released', provenance_kind: 'transferred' },
      { event_kind: 'transferred', provenance_kind: 'transferred' },
      { event_kind: 'escrowed', provenance_kind: 'used_in_operation' },
      { event_kind: 'released', provenance_kind: 'transferred' },
    ]), 'Belladonna retains one exact unique-item provenance chain end to end');
  } finally {
    try {
      const operationIds = (await pool.query(
        'SELECT id FROM world_operations WHERE crew_id=$1', [crewId],
      )).rows.map(({ id }) => id);
      const mysteryIds = (await pool.query(
        `SELECT id FROM mystery_instances
          WHERE authority_account_id IN ($1,$2,$3,$4)`, accounts,
      )).rows.map(({ id }) => id);
      const custodyIds = [...operationIds, ...mysteryIds];
      const ownerIds = [...accounts, ...characters, ...custodyIds];
      const guardKeys = [];
      for (const ownerId of ownerIds) {
        const rows = (await pool.query(
          'SELECT idempotency_key FROM item_mutation_guards WHERE owner_id=$1', [ownerId],
        )).rows;
        guardKeys.push(...rows.map(({ idempotency_key: key }) => key));
      }
      for (const custodyId of custodyIds) {
        await pool.query('DELETE FROM operation_escrow WHERE operation_id=$1', [custodyId]);
      }
      for (const guardKey of new Set(guardKeys)) {
        await pool.query('DELETE FROM item_events WHERE idempotency_key=$1', [guardKey]);
      }
      for (const ownerId of ownerIds) {
        await pool.query('DELETE FROM item_instances WHERE owner_id=$1', [ownerId]);
      }
      for (const guardKey of new Set(guardKeys)) {
        await pool.query('DELETE FROM item_mutation_guards WHERE idempotency_key=$1', [guardKey]);
      }
      for (const id of operationIds) {
        await pool.query('DELETE FROM world_operation_contributions WHERE operation_id=$1', [id]);
        await pool.query('DELETE FROM world_operation_node_state WHERE operation_id=$1', [id]);
        await pool.query('DELETE FROM world_operation_roles WHERE operation_id=$1', [id]);
      }
      await pool.query('DELETE FROM world_operations WHERE crew_id=$1', [crewId]);
      for (const id of mysteryIds) {
        await pool.query('DELETE FROM mystery_choices WHERE instance_id=$1', [id]);
        await pool.query('DELETE FROM mystery_node_state WHERE instance_id=$1', [id]);
        await pool.query('DELETE FROM mystery_instances WHERE id=$1', [id]);
      }
      for (const ownerId of ownerIds) {
        await pool.query('DELETE FROM item_stacks WHERE owner_id=$1', [ownerId]);
      }
      for (const characterId of characters) {
        await pool.query('DELETE FROM transactions WHERE character_id=$1', [characterId]);
        await pool.query('DELETE FROM cars WHERE character_id=$1', [characterId]);
        await pool.query('DELETE FROM character_skills WHERE character_id=$1', [characterId]);
      }
      for (const accountId of accounts) {
        await pool.query('DELETE FROM crew_members WHERE account_id=$1', [accountId]);
      }
      await pool.query('DELETE FROM crews WHERE id=$1', [crewId]);
      for (const characterId of characters) {
        await pool.query('DELETE FROM characters WHERE id=$1', [characterId]);
      }
      for (const accountId of accounts) {
        await pool.query('DELETE FROM account_persistent WHERE account_id=$1', [accountId]);
      }

      let residueCount = 0;
      for (const characterId of characters) {
        residueCount += await n('SELECT COUNT(*) AS n FROM characters WHERE id=$1', [characterId]);
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [characterId],
        );
        residueCount += await n('SELECT COUNT(*) AS n FROM cars WHERE character_id=$1', [characterId]);
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM character_skills WHERE character_id=$1', [characterId],
        );
      }
      for (const accountId of accounts) {
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM account_persistent WHERE account_id=$1', [accountId],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM crew_members WHERE account_id=$1', [accountId],
        );
      }
      residueCount += await n('SELECT COUNT(*) AS n FROM crews WHERE id=$1', [crewId]);
      for (const id of operationIds) {
        residueCount += await n('SELECT COUNT(*) AS n FROM world_operations WHERE id=$1', [id]);
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM world_operation_contributions WHERE operation_id=$1', [id],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM world_operation_node_state WHERE operation_id=$1', [id],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM world_operation_roles WHERE operation_id=$1', [id],
        );
      }
      for (const id of mysteryIds) {
        residueCount += await n('SELECT COUNT(*) AS n FROM mystery_instances WHERE id=$1', [id]);
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM mystery_choices WHERE instance_id=$1', [id],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM mystery_node_state WHERE instance_id=$1', [id],
        );
      }
      for (const id of custodyIds) {
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [id],
        );
      }
      for (const guardKey of new Set(guardKeys)) {
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM item_events WHERE idempotency_key=$1', [guardKey],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1', [guardKey],
        );
      }
      for (const ownerId of ownerIds) {
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM item_instances WHERE owner_id=$1', [ownerId],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM item_stacks WHERE owner_id=$1', [ownerId],
        );
        residueCount += await n(
          'SELECT COUNT(*) AS n FROM item_mutation_guards WHERE owner_id=$1', [ownerId],
        );
      }
      check(residueCount === 0, 'Belladonna PostgreSQL fixture cleanup leaves no run-owned rows',
        `${residueCount} rows remain`);
    } catch (error) {
      check(false, 'Belladonna PostgreSQL fixture cleanup is complete', error.message);
      throw error;
    }
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  if (process.argv[2] !== '--pg-mem' || process.env.DATABASE_URL) {
    console.error('Run `node tools/pgcheck-belladonna.js --pg-mem` with DATABASE_URL unset.');
    process.exit(2);
  }
  const { makeDb } = await import('../src/db.js');
  const pool = await makeDb();
  const failures = [];
  const check = (ok, label, detail = '') => {
    if (ok) console.log(`  ✓ ${label}`);
    else {
      failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
      console.error(`  ✗ ${failures.at(-1)}`);
    }
  };
  try {
    const controlRunId = `pgmem-belladonna-${process.pid}-${Date.now()}`;
    await runBelladonnaPgChecks({
      pool, check, nativePostgres: false,
      runId: controlRunId,
    });
    await runBelladonnaPgChecks({
      pool, check, nativePostgres: false,
      runId: controlRunId,
    });
  } finally {
    await pool.end();
  }
  if (failures.length) process.exit(1);
  console.log('✅ Belladonna pg-mem harness control passed');
}
