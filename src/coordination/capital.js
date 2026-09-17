// Gameplay cash held for an authored operation; there is no OMR or external-money path.
// Callers prelock all participating and original deposited character IDs in sorted order,
// BEFORE Family/operation locks. They then lock the operation and enter its declared
// operation_action item mutation. Repeated character locks below verify that authority;
// they do not replace the caller's lock order. The outer mutation owns exact-key replay.
import { GameError, ledger } from '../game.js';
import { assertOperationMutation, poisonItemTransaction, registerItemTransactionUndo } from '../items.js';

const MAX_AMOUNT = 1000000;
const MAX_CASH = Number.MAX_SAFE_INTEGER;
const fail = (code) => { throw new GameError(code, 'Operation capital is unavailable.'); };
const id = (value) => {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) fail('bad_capital_request');
  return value;
};
function fields(input, expected) {
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    || Reflect.ownKeys(input).length !== expected.length
    || expected.some((field) => !Object.hasOwn(input, field))
    || Reflect.ownKeys(input).some((field) => !expected.includes(field)
      || !Object.getOwnPropertyDescriptor(input, field)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(input, field), 'value'))) fail('bad_capital_request');
}
function amount(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_AMOUNT) fail('bad_capital_request');
  return value;
}
async function guarded(client, action) {
  try { return await action(); }
  catch (error) {
    // Compound item roots must remain failed even if an integration catches this error.
    try { poisonItemTransaction(client, error); } catch { /* invalid clients have no transaction to poison */ }
    throw error;
  }
}
const identity = (input) => [id(input.operationId), id(input.roleId), id(input.requirementId)];
const rowIdentity = (row) => [row.operation_id, row.role_id, row.requirement_id];
const receipt = (row) => Object.freeze({ operationId: row.operation_id, roleId: row.role_id,
  requirementId: row.requirement_id, accountId: row.account_id, characterId: row.character_id,
  amount: Number(row.amount), state: row.state });
const lockedEscrow = async (client, ids) => (await client.query(`SELECT * FROM world_operation_capital
  WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3 FOR UPDATE`, ids)).rows[0];

function restoreEscrow(client, previous, ids) {
  registerItemTransactionUndo(client, () => previous
    ? client.query(`UPDATE world_operation_capital SET account_id=$4,character_id=$5,amount=$6,state=$7,updated_at=$8
        WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3`,
    [...ids, previous.account_id, previous.character_id, previous.amount, previous.state, previous.updated_at])
    : client.query('DELETE FROM world_operation_capital WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3', ids));
}
function restoreCash(client, character) {
  registerItemTransactionUndo(client, () => client.query('UPDATE characters SET cash=$2 WHERE id=$1',
    [character.id, character.cash]));
}
async function audit(client, row, reason, signedAmount, personal) {
  await ledger(client, { characterId: personal ? row.character_id : null,
    accountId: personal ? row.account_id : null, currency: 'cash', amount: signedAmount,
    reason: `coordination:capital:${reason}`, counterparty: row.operation_id }, {
    beforeInsert: (transactionId) => registerItemTransactionUndo(client,
      () => client.query('DELETE FROM transactions WHERE id=$1', [transactionId])),
  });
}
function validCash(character) {
  const cash = Number(character.cash);
  if (!Number.isFinite(cash) || cash < 0 || cash > MAX_CASH) fail('capital_overflow');
  return cash;
}

/** Deposit the authenticated root owner's cash against one authored role requirement. */
export async function depositCapital(client, input, mutation) {
  return guarded(client, async () => {
    fields(input, ['operationId', 'roleId', 'requirementId', 'characterId', 'amount']);
    const ids = identity(input), characterId = id(input.characterId), required = amount(input.amount);
    const authority = assertOperationMutation(client, mutation, ids[0]);
    if (authority.owner.scope !== 'account') fail('capital_unavailable');
    const accountId = authority.owner.id;
    const character = (await client.query('SELECT id,account_id,alive,cash FROM characters WHERE id=$1 FOR UPDATE', [characterId])).rows[0];
    if (!character?.alive || character.account_id !== accountId) fail('capital_unavailable');
    if (validCash(character) < required) fail('capital_cash');
    const previous = await lockedEscrow(client, ids);
    if (previous?.state === 'held') fail('capital_held');
    if (previous && !['refunded', 'spent', 'forfeited'].includes(previous.state)) fail('capital_unavailable');
    restoreCash(client, character);
    const debited = await client.query(`UPDATE characters SET cash=cash-$3
      WHERE id=$1 AND account_id=$2 AND alive=true AND cash >= $3 AND cash <= $4 RETURNING cash`,
    [characterId, accountId, required, MAX_CASH]);
    if (debited.rowCount !== 1) fail('capital_cash');
    restoreEscrow(client, previous, ids);
    const next = previous
      ? await client.query(`UPDATE world_operation_capital SET account_id=$4,character_id=$5,amount=$6,state='held',updated_at=now()
          WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3 AND state=$7 RETURNING *`,
      [...ids, accountId, characterId, required, previous.state])
      : await client.query(`INSERT INTO world_operation_capital(operation_id,role_id,requirement_id,account_id,character_id,amount,state)
          VALUES($1,$2,$3,$4,$5,$6,'held') ON CONFLICT(operation_id,role_id,requirement_id) DO NOTHING RETURNING *`,
      [...ids, accountId, characterId, required]);
    if (next.rowCount !== 1) fail('capital_held');
    await audit(client, next.rows[0], 'deposit', -required, true);
    return receipt(next.rows[0]);
  });
}

async function closeHeld(client, row, disposition) {
  const required = amount(Number(row.amount));
  let nextState = 'spent';
  if (disposition === 'refund') {
    const character = (await client.query('SELECT id,account_id,alive,cash FROM characters WHERE id=$1 FOR UPDATE',
      [row.character_id])).rows[0];
    if (character?.alive && character.account_id === row.account_id) {
      validCash(character);
      restoreCash(client, character);
      const refunded = await client.query(`UPDATE characters SET cash=cash+$3
        WHERE id=$1 AND account_id=$2 AND alive=true AND cash >= 0 AND cash <= $4 RETURNING cash`,
      [character.id, row.account_id, required, MAX_CASH - required]);
      if (refunded.rowCount !== 1) fail('capital_overflow');
      nextState = 'refunded';
    } else nextState = 'forfeited';
  }
  const ids = rowIdentity(row);
  restoreEscrow(client, row, ids);
  const changed = await client.query(`UPDATE world_operation_capital SET state=$4,updated_at=now()
    WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3 AND state='held' RETURNING *`, [...ids, nextState]);
  if (changed.rowCount !== 1) fail('capital_unavailable');
  const personal = nextState === 'refunded';
  await audit(client, row, personal ? 'refund' : nextState === 'spent' ? 'spend' : 'forfeit',
    personal ? required : -required, personal);
  return receipt(changed.rows[0]);
}

/** Refund only the original living character; death/replacement forfeits the held cash. */
export async function refundCapital(client, input, mutation) {
  return guarded(client, async () => {
    fields(input, ['operationId', 'roleId', 'requirementId']);
    const ids = identity(input);
    assertOperationMutation(client, mutation, ids[0]);
    const row = await lockedEscrow(client, ids);
    return row?.state === 'held' ? closeHeld(client, row, 'refund') : null;
  });
}

/** Close every held requirement under the caller's already-locked operation. */
export async function settleCapital(client, operationId, disposition, mutation) {
  return guarded(client, async () => {
    id(operationId);
    if (!['refund', 'spend'].includes(disposition)) fail('bad_capital_request');
    assertOperationMutation(client, mutation, operationId);
    const rows = (await client.query(`SELECT * FROM world_operation_capital
      WHERE operation_id=$1 AND state='held' ORDER BY role_id,requirement_id FOR UPDATE`, [operationId])).rows;
    const results = [];
    for (const row of rows) results.push(await closeHeld(client, row, disposition));
    return results;
  });
}
