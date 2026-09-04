// Real-PostgreSQL-only choice race for the Phase 1 mystery runtime.
// The pg-mem suite proves semantics, but only native MVCC can show that two distinct backends
// committing different options serialize through the instance lock and leave one immutable choice.
import crypto from 'node:crypto';
import {
  commitChoice,
  createMysteryContext,
  startMystery,
} from '../src/mysteries.js';
import { withItemTransaction } from '../src/items.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

function twoBackendBarrier(pool) {
  const pids = [];
  let arrivals = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  return {
    pids,
    pool: {
      async connect() {
        const inner = await pool.connect();
        return new Proxy(inner, {
          get(target, property) {
            if (property === 'query') return async (sql, params) => {
              const result = await target.query(sql, params);
              if (/^\s*BEGIN\s*$/i.test(String(sql))) {
                await target.query("SET LOCAL lock_timeout='3s'");
                pids.push(Number((await target.query(
                  'SELECT pg_backend_pid() AS pid',
                )).rows[0].pid));
                arrivals += 1;
                if (arrivals === 2) release();
                await ready;
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

export async function runMysteryPgChecks({ pool, check }) {
  const stamp = `${process.pid}-${Date.now()}`;
  const prefix = `pgcheck-mystery-${stamp}`;
  const graphId = `${prefix}-graph`;
  const accountId = crypto.randomUUID();
  const characterId = crypto.randomUUID();
  const owner = Object.freeze({ scope: 'account', id: accountId });
  const keys = [`${prefix}-left`, `${prefix}-right`];
  const registry = loadAndValidateGraphPackages([{
    id: graphId,
    version: 1,
    season: 'pgcheck',
    dependsOn: [],
    nodes: [{
      id: `${prefix}-choice`,
      type: 'choice',
      visibility: 'public',
      options: [{ id: 'left' }, { id: 'right' }],
    }],
  }]);
  const context = createMysteryContext({ registry, accountId });

  try {
    await pool.query(
      `INSERT INTO characters (id,account_id,name,season)
       VALUES ($1,$2,$3,1)`,
      [characterId, accountId, `PG Mystery ${stamp}`.slice(0, 24)],
    );
    const started = await withItemTransaction(pool, (client) => startMystery(
      client, context, owner, graphId, 1, `${prefix}-start`,
    ));

    const barrier = twoBackendBarrier(pool);
    const choices = await Promise.allSettled(['left', 'right'].map((choiceId, index) => (
      withItemTransaction(barrier.pool, (client) => commitChoice(
        client, context, owner, graphId, `${prefix}-choice`, choiceId, {
          idempotencyKey: keys[index],
        },
      ))
    )));
    const winners = choices.filter(({ status }) => status === 'fulfilled');
    const losers = choices.filter(({ status }) => status === 'rejected');
    check(new Set(barrier.pids).size === 2,
      'mystery choice race reaches two distinct PostgreSQL backends',
      `pids ${barrier.pids.join(', ')}`);
    check(winners.length === 1 && losers.length === 1
      && losers[0]?.reason?.code === 'choice_committed',
    'competing mystery choices commit exactly one immutable option',
    choices.map((result) => result.status === 'fulfilled'
      ? `ok:${result.value.choice.id}` : `error:${result.reason?.code}`).join(' | '));

    const choiceRows = (await pool.query(
      `SELECT choice_id FROM mystery_choices WHERE instance_id=$1 AND node_id=$2`,
      [started.instanceId, `${prefix}-choice`],
    )).rows;
    const stateRows = (await pool.query(
      `SELECT state FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2`,
      [started.instanceId, `${prefix}-choice`],
    )).rows;
    const committedGuards = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM item_mutation_guards
        WHERE idempotency_key = ANY($1::text[]) AND result_json IS NOT NULL`,
      [keys],
    )).rows[0].n);
    check(choiceRows.length === 1 && ['left', 'right'].includes(choiceRows[0].choice_id)
      && stateRows.length === 1 && stateRows[0].state === 'completed'
      && committedGuards === 1,
    'mystery race leaves one choice, one completed node, and one completed mutation guard',
    `choices ${choiceRows.length}, states ${stateRows.length}, guards ${committedGuards}`);

    const ledgerRows = Number((await pool.query(
      `SELECT COUNT(*) AS n FROM transactions
        WHERE character_id=$1 AND (reason LIKE 'mystery:%' OR reason LIKE 'worldgraph:%')`,
      [characterId],
    )).rows[0].n);
    check(ledgerRows === 0, 'mystery choice race creates no cash or OMR ledger authority',
      `ledger rows ${ledgerRows}`);
  } finally {
    const instances = (await pool.query(
      'SELECT id FROM mystery_instances WHERE graph_id=$1', [graphId],
    )).rows.map(({ id }) => id);
    if (instances.length) {
      await pool.query('DELETE FROM mystery_choices WHERE instance_id = ANY($1::text[])', [instances]);
      await pool.query('DELETE FROM mystery_node_state WHERE instance_id = ANY($1::text[])', [instances]);
      await pool.query('DELETE FROM operation_escrow WHERE operation_id = ANY($1::text[])', [instances]);
      await pool.query('DELETE FROM mystery_instances WHERE id = ANY($1::text[])', [instances]);
    }
    await pool.query('DELETE FROM item_events WHERE idempotency_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM item_mutation_guards WHERE idempotency_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM characters WHERE id=$1', [characterId]);
  }
}
