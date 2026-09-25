// Exact native inputs for the unchanged operation pilot's capital recovery.
import assert from 'node:assert/strict';
import { equation, exactSum, negate, sha256 } from './rc1-resource-journal.js';

export const CAPITAL_LIFECYCLE_TABLES = ['characters', 'account_persistent', 'transactions', 'world_operations',
  'world_operation_roles', 'world_operation_commitments', 'world_operation_contributions', 'world_operation_capital',
  'world_operation_events', 'item_instances', 'item_stacks', 'item_lots', 'operation_escrow', 'item_events',
  'item_mutation_inputs', 'item_mutation_outputs', 'item_mutation_guards', 'world_kernel_objects', 'world_kernel_events',
  'gangs', 'gang_members', 'crew_members'];
const stable = ({ boundary, ...state }) => state;
export const capitalStateHash = state => sha256(stable(state));
const key = row => JSON.stringify([row.operation_id, row.role_id, row.requirement_id]);
const held = row => row?.state === 'held' ? row.amount : '0';
function index(rows, identity = row => row.id) {
  const values = new Map(rows.map(row => [identity(row), row])); assert.equal(values.size, rows.length, 'Duplicate authoritative identity'); return values;
}
const columnsCache = new WeakMap();
export async function snapshotCapitalResources(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    let columns = columnsCache.get(pool);
    if (!columns) {
      columns = (await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
        WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [CAPITAL_LIFECYCLE_TABLES])).rows;
      columnsCache.set(pool, columns);
    }
    const state = {};
    for (const table of CAPITAL_LIFECYCLE_TABLES) {
      const selection = columns.filter(row => row.table_name === table).map(row => {
        assert(/^[a-z_][a-z_0-9]*$/.test(row.column_name));
        return `"${row.column_name}"${['numeric', 'decimal', 'bigint'].includes(row.data_type) ? '::text' : ''} AS "${row.column_name}"`;
      }).join(','); assert(selection, `Missing ${table}`);
      state[table] = JSON.parse(JSON.stringify((await client.query(`SELECT ${selection} FROM "${table}"`)).rows))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    state.boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export function reconcileCapitalLifecycle(before, after, { logicalAt } = {}) {
  for (const table of CAPITAL_LIFECYCLE_TABLES) assert(Array.isArray(before[table]) && Array.isArray(after[table]), `Missing ${table}`);
  const appendOnly = (table, identity) => {
    const prior = index(before[table], identity), final = index(after[table], identity);
    for (const [id, row] of prior) assert.deepEqual(final.get(id), row, `Immutable ${table} row removed/changed`);
    return after[table].filter(row => !prior.has((identity || (r => r.id))(row)));
  };
  const receipts = appendOnly('transactions'), events = appendOnly('world_operation_events');
  appendOnly('item_events'); appendOnly('item_mutation_inputs', row => JSON.stringify([row.mutation_id, row.input_ordinal]));
  appendOnly('item_mutation_outputs', row => JSON.stringify([row.mutation_id, row.output_ordinal]));
  const priorGuards = before.item_mutation_guards.filter(row => row.completed_at && row.result_json), finalGuards = index(after.item_mutation_guards, row => row.idempotency_key);
  for (const row of priorGuards) assert.deepEqual(finalGuards.get(row.idempotency_key), row, 'Completed mutation receipt changed');
  for (const table of ['item_instances', 'item_stacks', 'item_lots', 'operation_escrow']) assert.deepEqual(after[table], before[table], 'Material custody outside this focused case group');
  const equations = [], refs = receipts.map(row => ({ table: 'transactions', id: row.id }));
  const authority = refs.length ? refs : [{ rule: 'No resource receipt; covered custody unchanged' }];
  for (const receipt of receipts) assert(['coordination:capital:deposit', 'coordination:capital:refund', 'coordination:capital:forfeit',
    'coordination:capital:spend', 'death:estate', 'death:legacy'].includes(receipt.reason), `Unclassified receipt ${receipt.reason}`);
  for (const person of after.characters) {
    const prior = before.characters.find(row => row.id === person.id);
    if (!prior) assert(person.generation > 1 && before.characters.some(row => row.account_id === person.account_id), 'Unexplained character birth');
    for (const resource of ['cash', 'ammo', 'cb']) {
      const rows = receipts.filter(row => row.character_id === person.id && row.currency === resource);
      const term = reason => exactSum(rows.filter(row => row.reason === reason).map(row => row.amount));
      const born = prior ? '0' : resource === 'cash' ? '500' : resource === 'ammo' ? '25' : '0';
      equations.push(equation({ resource, owner: `character:${person.id}`, before: prior ? resource === 'cash' ? exactSum([prior.cash, prior.bank]) : prior[resource] : '0',
        after: resource === 'cash' ? exactSum([person.cash, person.bank]) : person[resource], created: exactSum([born, term('death:legacy')]),
        destroyed: negate(term('death:estate')), transferredIn: term('coordination:capital:refund'),
        transferredOut: negate(term('coordination:capital:deposit')), authority }));
    }
  }
  for (const person of before.characters) assert(after.characters.some(row => row.id === person.id), 'Character receipt owner deleted');
  for (const row of after.account_persistent) {
    const prior = before.account_persistent.find(p => p.account_id === row.account_id); assert(prior);
    for (const field of ['omr', 'staked', 'unbonding', 'rewards']) assert.equal(row[field], prior[field], 'OMR movement outside this scope');
  }
  assert.equal(after.account_persistent.length, before.account_persistent.length);
  const oldCash = index(before.world_operation_capital, key), newCash = index(after.world_operation_capital, key);
  for (const receipt of receipts.filter(row => row.reason.startsWith('coordination:capital:')))
    assert(after.world_operation_capital.some(row => row.operation_id === receipt.counterparty), 'Capital receipt lacks an obligation');
  for (const id of oldCash.keys()) assert(newCash.has(id), 'Capital disposition row removed');
  for (const [id, row] of newCash) {
    assert(['held', 'refunded', 'forfeited', 'spent'].includes(row.state), 'Unknown capital disposition');
    const prior = oldCash.get(id);
    if (prior) for (const field of ['operation_id', 'role_id', 'requirement_id', 'account_id', 'character_id', 'amount'])
      assert.equal(row[field], prior[field], `Capital original owner/binding rewritten: ${field}`);
    assert.equal(row.role_id, 'organizer'); assert.equal(row.requirement_id, 'funding'); assert.equal(exactSum([row.amount]), '100');
    assert.equal(after.world_operation_capital.filter(r => r.operation_id === row.operation_id).length, 1, 'Scoped pilot has one capital requirement');
    const matched = receipts.filter(r => r.counterparty === row.operation_id && r.reason.startsWith('coordination:capital:'));
    const term = suffix => exactSum(matched.filter(r => r.reason === `coordination:capital:${suffix}`).map(r => r.amount));
    for (const r of matched) {
      assert.equal(r.currency, 'cash');
      if (['coordination:capital:deposit', 'coordination:capital:refund'].includes(r.reason)) {
        assert.equal(r.character_id, row.character_id, 'Capital receipt targets wrong original character');
        assert.equal(r.account_id, row.account_id, 'Capital receipt targets wrong account');
      } else { assert.equal(r.character_id, null); assert.equal(r.account_id, null); }
    }
    if (row.state !== prior?.state) {
      const expected = row.state === 'held' ? 'deposit' : row.state === 'refunded' ? 'refund' : row.state === 'forfeited' ? 'forfeit' : 'spend';
      assert.equal(matched.length, 1, 'Each scoped capital transition has exactly one authoritative receipt');
      assert.equal(matched[0].reason, `coordination:capital:${expected}`);
      assert.equal(exactSum([matched[0].amount]), row.state === 'refunded' ? '100' : '-100');
      const original = after.characters.find(r => r.id === row.character_id);
      if (row.state === 'refunded') assert(original?.alive && original.account_id === row.account_id, 'Refund reached a dead/replaced identity');
      if (row.state === 'forfeited') assert(!original?.alive || original.account_id !== row.account_id, 'Living depositor capital forfeited');
    } else assert.equal(matched.length, 0, 'Replay repeated a capital receipt');
    equations.push(equation({ resource: 'cash', owner: `capital:${id}`, before: held(prior), after: held(row),
      transferredIn: negate(term('deposit')), transferredOut: term('refund'), destroyed: negate(exactSum([term('forfeit'), term('spend')])), authority }));
  }
  for (const row of after.world_operations) {
    const prior = before.world_operations.find(r => r.id === row.id);
    if (prior) for (const field of ['created_at', 'expires_at', 'graph_id', 'graph_version', 'coordination_definition_hash', 'coordination_definition_json'])
      assert.equal(row[field], prior[field], `Operation identity/deadline rewritten: ${field}`);
    assert.equal(Date.parse(row.expires_at) - Date.parse(row.created_at), 86400000, 'Pilot original24h duration changed');
    if (row.status === 'expired' && prior?.status !== 'expired') assert(logicalAt >= Date.parse(row.expires_at), 'Operation expired early');
  }
  for (const row of before.world_operations) assert(after.world_operations.some(final => final.id === row.id), 'Operation receipt owner deleted');
  const total = state => exactSum([...state.characters.flatMap(row => [row.cash, row.bank]), ...state.world_operation_capital.map(held)]);
  const births = after.characters.filter(row => !before.characters.some(p => p.id === row.id)).length;
  const cash = receipts.filter(row => row.currency === 'cash');
  const creation = exactSum([String(births * 500), ...cash.filter(row => row.reason === 'death:legacy').map(row => row.amount)]);
  const destruction = negate(exactSum(cash.filter(row => ['death:estate', 'coordination:capital:forfeit', 'coordination:capital:spend'].includes(row.reason)).map(row => row.amount)));
  equations.push(equation({ resource: 'cash', owner: 'personal-plus-held-capital', before: total(before), after: total(after), created: creation, destroyed: destruction, authority }));
  return { beforeHash: capitalStateHash(before), afterHash: capitalStateHash(after), receipts, events, equations,
    status: 'PASS_SCOPED_CAPITAL_CUSTODY', qualifyingFullResourcePass: false };
}
