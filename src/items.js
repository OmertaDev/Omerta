// Conserved inventory primitives for authored world graphs.
//
// Mutation callers enter through withItemTransaction and receive its branded client. That lets a
// recipe, salvage, mystery, or social operation lock its authority rows and inventory rows under one
// module-owned COMMIT. Every mutation reserves a globally unique logical key, applies conditional
// DML, appends provenance, and completes the replay result inside that boundary.
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { dbCaps } from './db.js';
import { GameError } from './game.js';

const OWNER_SCOPES = new Set(['character', 'account', 'operation']);
const COMPOSITE_MUTATION_KINDS = new Set([
  'craft', 'salvage_car', 'mystery_action', 'operation_action', 'reward_claim',
]);
const CREATION_PROVENANCE_KINDS = new Set(['crafted', 'salvaged', 'awarded', 'imported']);
const ESCROW_PROVENANCE_KINDS = new Set(['used_in_mystery', 'used_in_operation']);
const MUTATION_CONTEXTS = new WeakMap();
const ITEM_TRANSACTIONS = new WeakMap();
const TRANSACTION_SCOPE = new AsyncLocalStorage();
let PG_MEM_TRANSACTION_TAIL = Promise.resolve();
const INT_MAX = 2147483647;

const fail = (code, message, data) => { throw new GameError(code, message, data); };

function boundedText(value, label, max, code = 'bad_item_request') {
  if (typeof value !== 'string' || value.length < 1 || value.length > max
    || value.trim() !== value || !value.trim()) {
    fail(code, `${label} must be a non-empty canonical string of at most ${max} characters.`);
  }
  return value;
}

function itemOwner(owner, { allowOperation = true } = {}) {
  if (!owner || typeof owner !== 'object' || Array.isArray(owner)
    || !OWNER_SCOPES.has(owner.scope) || (!allowOperation && owner.scope === 'operation')) {
    fail('bad_item_owner', 'Item owner scope must be character, account, or operation.');
  }
  return {
    scope: owner.scope,
    id: boundedText(owner.id, 'Item owner id', 200, 'bad_item_owner'),
  };
}

function positiveQuantity(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > INT_MAX) {
    fail('qty', 'Item quantity must be a positive whole number within the inventory limit.');
  }
  return value;
}

const template = (value) => boundedText(value, 'Item template id', 200);
const qualityBand = (value) => boundedText(value ?? 'standard', 'Item quality', 80);
const mutationReason = (value) => boundedText(value, 'Item mutation reason', 500);
const logicalKey = (value) => boundedText(value, 'Item idempotency key', 200, 'bad_idempotency_key');

const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function transactionClient(client) {
  const transaction = client && typeof client === 'object' ? ITEM_TRANSACTIONS.get(client) : null;
  const scope = TRANSACTION_SCOPE.getStore();
  if (!client || typeof client.query !== 'function' || !transaction || !transaction.active
    || scope?.transaction !== transaction) {
    fail('item_transaction_required', 'Item mutation requires an active withItemTransaction client.');
  }
  return transaction;
}

async function activeTransaction(client) {
  transactionClient(client);
  if (!dbCaps.skipLocked) return client; // pg-mem has no SAVEPOINT syntax; focused tests own BEGIN.
  try {
    // PostgreSQL rejects SAVEPOINT outside an explicit transaction with 25P01. This is a real
    // transaction-state probe, not a PoolClient-shape guess, and RELEASE leaves no nested scope.
    await client.query('SAVEPOINT item_transaction_probe');
    await client.query('RELEASE SAVEPOINT item_transaction_probe');
  } catch (error) {
    if (error?.code === '25P01') {
      fail('item_transaction_required', 'Item mutation requires an active caller-owned transaction.');
    }
    throw error;
  }
  return transactionClient(client);
}

async function compensateItemTransaction(client, transaction) {
  // pg-mem parses BEGIN/COMMIT/ROLLBACK but ROLLBACK does not undo writes. Its test path is
  // serialized module-wide below, so a transaction-local inverse log gives the same externally visible
  // atomicity contract without overwriting a later successful item transaction. Events go first
  // because they reference both guards and permanent item rows; guards go last.
  for (const key of transaction.guardKeys) {
    await client.query('DELETE FROM item_events WHERE idempotency_key=$1', [key]);
  }
  for (let i = transaction.undo.length - 1; i >= 0; i--) await transaction.undo[i]();
  for (const key of transaction.guardKeys) {
    await client.query('DELETE FROM item_mutation_guards WHERE idempotency_key=$1', [key]);
  }
}

async function acquirePgMemTransaction() {
  if (dbCaps.skipLocked) return () => {};
  // pg-mem pool/client wrappers have no trustworthy canonical database identity: a Proxy or a
  // forwarding object can reach the same MemPg instance while carrying another object identity.
  // One module-global tail is deliberately conservative but cannot be split by caller aliases.
  const previous = PG_MEM_TRANSACTION_TAIL;
  let releaseGate;
  const gate = new Promise((resolve) => { releaseGate = resolve; });
  const tail = previous.then(() => gate);
  PG_MEM_TRANSACTION_TAIL = tail;
  await previous;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseGate();
    if (PG_MEM_TRANSACTION_TAIL === tail) PG_MEM_TRANSACTION_TAIL = Promise.resolve();
  };
}

async function waitForPgMemTransactions(queryable) {
  if (dbCaps.skipLocked) return;
  const transaction = ITEM_TRANSACTIONS.get(queryable);
  if (transaction && TRANSACTION_SCOPE.getStore()?.transaction === transaction) return;
  // All external pg-mem readers join the same barrier regardless of whether their query handle is
  // the pool, a checked-out adapter, a Proxy, or a forwarding alias. This prevents identity aliases
  // from observing writes which the active boundary may still compensate.
  await PG_MEM_TRANSACTION_TAIL;
}

/**
 * Own the only valid item-ledger transaction boundary.
 *
 * Nesting is rejected explicitly: a later runtime composes leaf operations through the branded
 * `client` it receives, and uses withItemMutation for one aggregate replay guard. Independent calls
 * may still run concurrently because AsyncLocalStorage scopes the nesting check to one async flow.
 * Real PostgreSQL supplies that concurrency with transactions and row locks. pg-mem's transaction
 * and lock statements are non-atomic simulations, so its branded boundaries serialize module-wide;
 * otherwise compensation from a failed transaction could erase a later committed mutation.
 */
export async function withItemTransaction(pool, action) {
  if (!pool || typeof pool.connect !== 'function' || typeof action !== 'function') {
    fail('item_transaction_required', 'Item transaction requires a database pool and callback.');
  }
  if (TRANSACTION_SCOPE.getStore()) {
    fail('item_transaction_nested', 'Item transactions cannot be nested; reuse the active client.');
  }
  return TRANSACTION_SCOPE.run({ active: true }, async () => {
    const scope = TRANSACTION_SCOPE.getStore();
    const releasePgMemTransaction = await acquirePgMemTransaction();
    let client = null;
    const transaction = { active: false, failed: null, guardKeys: new Set(), undo: [] };
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      transaction.active = true;
      ITEM_TRANSACTIONS.set(client, transaction);
      scope.transaction = transaction;
      const result = await action(client);
      if (transaction.failed) throw transaction.failed;
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (client && !dbCaps.skipLocked && transaction.active) {
        try { await compensateItemTransaction(client, transaction); }
        catch (compensationError) {
          compensationError.cause = error;
          throw compensationError;
        }
      }
      throw error;
    } finally {
      transaction.active = false;
      if (client) {
        ITEM_TRANSACTIONS.delete(client);
        client.release();
      }
      releasePgMemTransaction();
    }
  });
}

function registerUndo(client, undo) {
  const transaction = transactionClient(client);
  transaction.undo.push(undo);
}

/**
 * Register compensation for non-item authority consumed by a compound item action.
 *
 * This is an internal integration seam for authoritative adapters such as vehicle salvage. The
 * callback is used only by pg-mem, whose ROLLBACK does not undo writes; real PostgreSQL relies on
 * the surrounding transaction. Callers must already be inside `withItemTransaction`, and graph
 * content never receives this capability.
 */
export function registerItemTransactionUndo(client, undo) {
  transactionClient(client);
  if (typeof undo !== 'function') {
    fail('bad_item_request', 'Item transaction compensation requires a callback.');
  }
  registerUndo(client, undo);
}

async function beginMutation(client, kind, owner, idempotencyKey, request) {
  await activeTransaction(client);
  const key = logicalKey(idempotencyKey);
  const requestHash = digest({ kind, owner, request });
  const reservationId = crypto.randomUUID();
  await client.query(
    `INSERT INTO item_mutation_guards
       (idempotency_key, mutation_kind, owner_scope, owner_id, request_hash, reservation_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [key, kind, owner.scope, owner.id, requestHash, reservationId],
  );
  const row = (await client.query(
    `SELECT mutation_kind, owner_scope, owner_id, request_hash, reservation_id, result_json
       FROM item_mutation_guards WHERE idempotency_key=$1 FOR UPDATE`,
    [key],
  )).rows[0];
  if (!row || row.mutation_kind !== kind || row.owner_scope !== owner.scope
    || row.owner_id !== owner.id || row.request_hash !== requestHash) {
    fail('idempotency_conflict', 'That item idempotency key is already bound to another mutation.');
  }
  if (row.result_json !== null && row.result_json !== undefined) {
    return { key, replay: JSON.parse(row.result_json) };
  }
  if (row.reservation_id !== reservationId) {
    fail('idempotency_in_progress', 'That item mutation is still in progress.');
  }
  transactionClient(client).guardKeys.add(key);
  return { key, reservationId, replay: null };
}

async function abandonMutation(client, guard) {
  if (!guard?.reservationId) return;
  await client.query('DELETE FROM item_events WHERE idempotency_key=$1', [guard.key]).catch(() => {});
  await client.query(
    `DELETE FROM item_mutation_guards
      WHERE idempotency_key=$1 AND reservation_id=$2 AND result_json IS NULL`,
    [guard.key, guard.reservationId],
  ).catch(() => {});
}

const ownerKey = (owner) => `${owner.scope}:${owner.id}`;

function compositeAuthority(request) {
  const raw = request?.itemAuthority;
  if (raw === undefined) return { destinations: new Set(), operations: new Set() };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || Object.keys(raw).some((key) => !['destinations', 'operations'].includes(key))
    || (raw.destinations !== undefined && !Array.isArray(raw.destinations))
    || (raw.operations !== undefined && !Array.isArray(raw.operations))) {
    fail('bad_item_request', 'itemAuthority accepts only destinations and operations arrays.');
  }
  const destinations = new Set((raw.destinations || []).map((owner) => (
    ownerKey(itemOwner(owner, { allowOperation: false }))
  )));
  const operations = new Set((raw.operations || []).map((id) => (
    itemOwner({ scope: 'operation', id }).id
  )));
  return { destinations, operations };
}

function assertCompositeAuthority(composite, kind, owner, request) {
  if (kind === 'release_escrow') {
    if (owner.scope !== 'operation' || !composite.authority.operations.has(owner.id)) {
      fail('item_mutation_authority', 'The compound mutation did not bind that escrow operation.');
    }
    if (!composite.authority.destinations.has(ownerKey(request.to))) {
      fail('item_mutation_authority', 'The compound mutation did not bind that destination owner.');
    }
    return;
  }
  if (ownerKey(owner) !== ownerKey(composite.rootOwner)) {
    fail('item_mutation_authority', 'A compound item mutation cannot spend or grant for another owner.');
  }
  if (kind === 'transfer_item') {
    if (!composite.authority.destinations.has(ownerKey(request.to))) {
      fail('item_mutation_authority', 'The compound mutation did not bind that destination owner.');
    }
  }
  if (kind === 'escrow_item' && !composite.authority.operations.has(request.operation.id)) {
    fail('item_mutation_authority', 'The compound mutation did not bind that operation destination.');
  }
}

async function completeMutation(client, guard, result) {
  const updated = await client.query(
    `UPDATE item_mutation_guards
        SET result_json=$3, completed_at=now()
      WHERE idempotency_key=$1 AND reservation_id=$2 AND result_json IS NULL`,
    [guard.key, guard.reservationId, JSON.stringify(result)],
  );
  if (updated.rowCount !== 1) {
    fail('idempotency_conflict', 'The item mutation lost its logical-key authority.');
  }
  return result;
}

async function executeMutation(client, kind, owner, key, request, action) {
  transactionClient(client);
  const composite = key && typeof key === 'object' ? MUTATION_CONTEXTS.get(key) : null;
  if (composite) {
    if (composite.client !== client || composite.closed) {
      fail('item_transaction_required', 'That item mutation context is not active on this transaction.');
    }
    try {
      assertCompositeAuthority(composite, kind, owner, request);
      composite.ordinal += 1;
      return await action(
        composite.guard, `${String(composite.ordinal).padStart(4, '0')}:${kind}`,
      );
    } catch (error) {
      composite.failed = error;
      transactionClient(client).failed ||= error;
      throw error;
    }
  }
  const guard = await beginMutation(client, kind, owner, key, request);
  if (guard.replay !== null) return guard.replay;
  try {
    const result = await action(guard, 'result');
    return await completeMutation(client, guard, result);
  } catch (error) {
    // Remove an unfinished logical claim before the module-owned boundary rolls back/compensates.
    // Events go first because their FK deliberately prevents orphaned provenance.
    await abandonMutation(client, guard);
    transactionClient(client).failed ||= error;
    throw error;
  }
}

// One logical action may consume several stacks and create/escrow several instances. The opaque
// context lets those leaf primitives share exactly one guard and append distinct ordinal events;
// replay returns the aggregate result without entering `action` at all. withItemTransaction owns the
// surrounding BEGIN/COMMIT/ROLLBACK and pg-mem compensation boundary.
export async function withItemMutation(
  client, ownerValue, mutationKindValue, idempotencyKey, request, action,
) {
  transactionClient(client);
  const owner = itemOwner(ownerValue);
  const mutationKind = boundedText(mutationKindValue, 'Item mutation kind', 80);
  if (!COMPOSITE_MUTATION_KINDS.has(mutationKind) || typeof action !== 'function') {
    fail('bad_item_request', 'Unsupported composite item mutation.');
  }
  let requestHashInput;
  try {
    requestHashInput = JSON.parse(JSON.stringify(request ?? {}));
  } catch {
    fail('bad_item_request', 'Composite item mutation request must be JSON-serializable.');
  }
  const authority = compositeAuthority(requestHashInput);
  const guard = await beginMutation(
    client, mutationKind, owner, idempotencyKey, requestHashInput,
  );
  if (guard.replay !== null) return guard.replay;
  const context = Object.freeze({});
  const state = {
    client, guard, rootOwner: owner, authority,
    ordinal: 0, closed: false, failed: null,
  };
  MUTATION_CONTEXTS.set(context, state);
  try {
    const result = await action(context);
    if (state.failed) throw state.failed;
    state.closed = true;
    return await completeMutation(client, guard, result);
  } catch (error) {
    state.closed = true;
    await abandonMutation(client, guard);
    transactionClient(client).failed ||= error;
    throw error;
  }
}

async function appendEvent(client, guard, {
  eventKey, eventKind, provenanceKind = null, itemId = null, templateId, quantityDelta = null,
  quantityBefore = null, quantityAfter = null, from = null, to = null, reason,
}) {
  await client.query(
    `INSERT INTO item_events
       (id, event_key, event_kind, provenance_kind, item_id, template_id,
        quantity_delta, quantity_before, quantity_after,
        from_owner_scope, from_owner_id, to_owner_scope, to_owner_id, reason, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [crypto.randomUUID(), eventKey, eventKind, provenanceKind, itemId, templateId,
      quantityDelta, quantityBefore, quantityAfter, from?.scope || null, from?.id || null,
      to?.scope || null, to?.id || null, reason, guard.key],
  );
}

const dateString = (value) => value == null ? null : new Date(value).toISOString();

function itemProjection(row) {
  return {
    id: row.id,
    templateId: row.template_id,
    owner: { scope: row.owner_scope, id: row.owner_id },
    state: row.state,
    escrowed: row.state === 'escrowed',
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
    consumedAt: dateString(row.consumed_at),
  };
}

async function lockedItem(client, itemId) {
  return (await client.query(
    `SELECT id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at
       FROM item_instances WHERE id=$1 FOR UPDATE`,
    [itemId],
  )).rows[0];
}

function registerItemRestore(client, row, custody = null) {
  registerUndo(client, async () => {
    await client.query('DELETE FROM operation_escrow WHERE item_id=$1', [row.id]);
    await client.query(
      `UPDATE item_instances
          SET template_id=$2, owner_scope=$3, owner_id=$4, state=$5,
              created_at=$6, updated_at=$7, consumed_at=$8
        WHERE id=$1`,
      [row.id, row.template_id, row.owner_scope, row.owner_id, row.state,
        row.created_at, row.updated_at, row.consumed_at],
    );
    if (custody) {
      await client.query(
        `INSERT INTO operation_escrow
           (item_id, owner_scope, operation_id, item_state,
            depositor_scope, depositor_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (item_id) DO UPDATE SET
           owner_scope=$2, operation_id=$3, item_state=$4,
           depositor_scope=$5, depositor_id=$6, created_at=$7`,
        [custody.item_id, custody.owner_scope, custody.operation_id, custody.item_state,
          custody.depositor_scope, custody.depositor_id, custody.created_at],
      );
    }
  });
}

function assertHeld(row, owner, { activeOnly = false } = {}) {
  if (!row || row.owner_scope !== owner.scope || row.owner_id !== owner.id
    || row.state === 'consumed' || (activeOnly && row.state !== 'active')) {
    fail('item_unavailable', 'That item is not spendable by this owner.');
  }
}

/** Grant a fungible stack quantity. Exact replay returns the first result. */
export async function grantStack(
  client, ownerValue, templateIdValue, qtyValue, qualityValue,
  reasonValue, idempotencyKey,
) {
  const owner = itemOwner(ownerValue);
  const templateId = template(templateIdValue);
  const qty = positiveQuantity(qtyValue);
  const quality = qualityBand(qualityValue);
  const reason = mutationReason(reasonValue);
  return executeMutation(client, 'grant_stack', owner, idempotencyKey,
    { templateId, qty, quality, reason }, async (guard, eventKey) => {
      const prior = (await client.query(
        `SELECT quantity, created_at, updated_at FROM item_stacks
          WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4
          FOR UPDATE`,
        [owner.scope, owner.id, templateId, quality],
      )).rows[0];
      const priorQuantity = Number(prior?.quantity || 0);
      // Keep the application-side bound explicit. PostgreSQL's integer type also rejects overflow,
      // but pg-mem does not reliably honor the conditional ON CONFLICT WHERE clause at INT_MAX;
      // compound rollback tests need both engines to reject the same late grant.
      if (!Number.isSafeInteger(priorQuantity) || priorQuantity > INT_MAX - qty) {
        fail('inventory_cap', 'That material grant would exceed the inventory quantity limit.');
      }
      registerUndo(client, async () => {
        if (!prior) {
          await client.query(
            `DELETE FROM item_stacks
              WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4`,
            [owner.scope, owner.id, templateId, quality],
          );
        } else {
          await client.query(
            `UPDATE item_stacks SET quantity=$5, created_at=$6, updated_at=$7
              WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4`,
            [owner.scope, owner.id, templateId, quality, priorQuantity,
              prior.created_at, prior.updated_at],
          );
        }
      });
      const result = await client.query(
        `INSERT INTO item_stacks
           (owner_scope, owner_id, template_id, quality, quantity)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (owner_scope, owner_id, template_id, quality)
         DO UPDATE SET quantity=item_stacks.quantity + EXCLUDED.quantity, updated_at=now()
           WHERE item_stacks.quantity <= $6 - EXCLUDED.quantity
         RETURNING quantity`,
        [owner.scope, owner.id, templateId, quality, qty, INT_MAX],
      );
      const after = Number(result.rows[0]?.quantity);
      if (!Number.isSafeInteger(after)) {
        fail('inventory_cap', 'That material grant would exceed the inventory quantity limit.');
      }
      const before = after - qty;
      await appendEvent(client, guard, {
        eventKey, eventKind: 'stack_granted', templateId, quantityDelta: qty,
        quantityBefore: before, quantityAfter: after, to: owner, reason,
      });
      return { owner, templateId, quality, qty: after, delta: qty };
    });
}

/** Consume a fungible stack quantity under a row lock and nonnegative conditional update. */
export async function consumeStack(
  client, ownerValue, templateIdValue, qtyValue, qualityValue,
  reasonValue, idempotencyKey,
) {
  const owner = itemOwner(ownerValue);
  const templateId = template(templateIdValue);
  const qty = positiveQuantity(qtyValue);
  const quality = qualityBand(qualityValue);
  const reason = mutationReason(reasonValue);
  return executeMutation(client, 'consume_stack', owner, idempotencyKey,
    { templateId, qty, quality, reason }, async (guard, eventKey) => {
      const row = (await client.query(
        `SELECT quantity, created_at, updated_at FROM item_stacks
          WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4
          FOR UPDATE`,
        [owner.scope, owner.id, templateId, quality],
      )).rows[0];
      const before = Number(row?.quantity || 0);
      if (before < qty) {
        fail('materials', 'This owner does not hold enough of that material.', {
          templateId, quality, current: before, required: qty,
        });
      }
      registerUndo(client, () => client.query(
        `UPDATE item_stacks SET quantity=$5, created_at=$6, updated_at=$7
          WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4`,
        [owner.scope, owner.id, templateId, quality, before, row.created_at, row.updated_at],
      ));
      const expectedAfter = before - qty;
      const changed = await client.query(
        `UPDATE item_stacks SET quantity=$6, updated_at=now()
          WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4
            AND quantity=$5
          RETURNING quantity`,
        [owner.scope, owner.id, templateId, quality, before, expectedAfter],
      );
      if (changed.rowCount !== 1) {
        fail('contention', 'The material inventory changed; retry the operation.');
      }
      const after = Number(changed.rows[0].quantity);
      await appendEvent(client, guard, {
        eventKey, eventKind: 'stack_consumed', templateId, quantityDelta: -qty,
        quantityBefore: before, quantityAfter: after, from: owner, reason,
      });
      return { owner, templateId, quality, qty: after, delta: -qty };
    });
}

/** Create one unique/stateful item with a permanent server-generated ID. */
export async function createItem(
  client, ownerValue, templateIdValue, reasonValue, idempotencyKey,
) {
  const owner = itemOwner(ownerValue, { allowOperation: false });
  const templateId = template(templateIdValue);
  const reason = mutationReason(reasonValue);
  if (!CREATION_PROVENANCE_KINDS.has(reason)) {
    fail('bad_item_provenance', 'Created items require a crafted, salvaged, awarded, or imported provenance.');
  }
  return executeMutation(client, 'create_item', owner, idempotencyKey,
    { templateId, reason }, async (guard, eventKey) => {
      const id = crypto.randomUUID();
      registerUndo(client, () => client.query('DELETE FROM item_instances WHERE id=$1', [id]));
      const row = (await client.query(
        `INSERT INTO item_instances (id, template_id, owner_scope, owner_id)
         VALUES ($1,$2,$3,$4)
         RETURNING id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at`,
        [id, templateId, owner.scope, owner.id],
      )).rows[0];
      await appendEvent(client, guard, {
        eventKey, eventKind: 'created', provenanceKind: reason,
        itemId: id, templateId, to: owner, reason,
      });
      return itemProjection(row);
    });
}

/** Transfer an active unique item between authoritative owners. */
export async function transferItem(
  client, fromOwnerValue, toOwnerValue, itemIdValue, reasonValue, idempotencyKey,
) {
  const from = itemOwner(fromOwnerValue, { allowOperation: false });
  const to = itemOwner(toOwnerValue, { allowOperation: false });
  const itemId = boundedText(itemIdValue, 'Item id', 200);
  const reason = mutationReason(reasonValue);
  if (from.scope === to.scope && from.id === to.id) {
    fail('same_item_owner', 'An item transfer requires two different owners.');
  }
  return executeMutation(client, 'transfer_item', from, idempotencyKey,
    { to, itemId, reason }, async (guard, eventKey) => {
      const current = await lockedItem(client, itemId);
      assertHeld(current, from, { activeOnly: true });
      registerItemRestore(client, current);
      const changed = await client.query(
        `UPDATE item_instances
            SET owner_scope=$2, owner_id=$3, updated_at=now()
          WHERE id=$1 AND owner_scope=$4 AND owner_id=$5 AND state='active'
          RETURNING id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at`,
        [itemId, to.scope, to.id, from.scope, from.id],
      );
      if (changed.rowCount !== 1) {
        fail('contention', 'The item owner changed; retry the operation.');
      }
      await appendEvent(client, guard, {
        eventKey, eventKind: 'transferred', provenanceKind: 'transferred',
        itemId, templateId: current.template_id,
        from, to, reason,
      });
      return itemProjection(changed.rows[0]);
    });
}

/** Permanently consume an owned or operation-escrowed unique item. */
export async function consumeItem(
  client, ownerValue, itemIdValue, reasonValue, idempotencyKey,
) {
  const owner = itemOwner(ownerValue);
  const itemId = boundedText(itemIdValue, 'Item id', 200);
  const reason = mutationReason(reasonValue);
  return executeMutation(client, 'consume_item', owner, idempotencyKey,
    { itemId, reason }, async (guard, eventKey) => {
      const current = await lockedItem(client, itemId);
      assertHeld(current, owner);
      let custody = null;
      if (current.state === 'escrowed') {
        custody = (await client.query(
          `SELECT item_id, owner_scope, operation_id, item_state,
                  depositor_scope, depositor_id, created_at
             FROM operation_escrow WHERE item_id=$1 FOR UPDATE`,
          [itemId],
        )).rows[0];
        if (!custody || custody.operation_id !== owner.id) {
          fail('item_not_escrowed', 'The operation does not hold this item escrow.');
        }
      }
      registerItemRestore(client, current, custody);
      if (custody) {
        const removed = await client.query(
          'DELETE FROM operation_escrow WHERE item_id=$1 AND operation_id=$2',
          [itemId, owner.id],
        );
        if (removed.rowCount !== 1) {
          fail('item_not_escrowed', 'The operation does not hold this item escrow.');
        }
      }
      const changed = await client.query(
        `UPDATE item_instances
            SET state='consumed', consumed_at=now(), updated_at=now()
          WHERE id=$1 AND owner_scope=$2 AND owner_id=$3 AND state<>'consumed'
          RETURNING id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at`,
        [itemId, owner.scope, owner.id],
      );
      if (changed.rowCount !== 1) {
        fail('contention', 'The item state changed; retry the operation.');
      }
      await appendEvent(client, guard, {
        eventKey, eventKind: 'consumed', provenanceKind: 'consumed',
        itemId, templateId: current.template_id,
        from: owner, reason,
      });
      return itemProjection(changed.rows[0]);
    });
}

/** Move an active character/account item into one operation's sole custody. */
export async function escrowItem(
  client, fromOwnerValue, operationIdValue, itemIdValue, reasonValue, idempotencyKey,
  provenanceKindValue = 'used_in_mystery',
) {
  const from = itemOwner(fromOwnerValue, { allowOperation: false });
  const operation = itemOwner({ scope: 'operation', id: operationIdValue });
  const itemId = boundedText(itemIdValue, 'Item id', 200);
  const reason = mutationReason(reasonValue);
  const provenanceKind = boundedText(provenanceKindValue, 'Escrow provenance kind', 80);
  if (!ESCROW_PROVENANCE_KINDS.has(provenanceKind)) {
    fail('bad_item_provenance', 'Escrow provenance must be used_in_mystery or used_in_operation.');
  }
  return executeMutation(client, 'escrow_item', from, idempotencyKey,
    { operation, itemId, reason, provenanceKind }, async (guard, eventKey) => {
      const current = await lockedItem(client, itemId);
      assertHeld(current, from, { activeOnly: true });
      registerItemRestore(client, current);
      const changed = await client.query(
        `UPDATE item_instances
            SET owner_scope='operation', owner_id=$2, state='escrowed', updated_at=now()
          WHERE id=$1 AND owner_scope=$3 AND owner_id=$4 AND state='active'
          RETURNING id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at`,
        [itemId, operation.id, from.scope, from.id],
      );
      if (changed.rowCount !== 1) {
        fail('contention', 'The item owner changed; retry the operation.');
      }
      await client.query(
        `INSERT INTO operation_escrow
           (item_id, operation_id, depositor_scope, depositor_id)
         VALUES ($1,$2,$3,$4)`,
        [itemId, operation.id, from.scope, from.id],
      );
      await appendEvent(client, guard, {
        eventKey, eventKind: 'escrowed', provenanceKind,
        itemId, templateId: current.template_id,
        from, to: operation, reason,
      });
      return itemProjection(changed.rows[0]);
    });
}

/** Release one escrowed item. Only the operation named by the custody row can release it. */
export async function releaseEscrow(
  client, operationIdValue, toOwnerValue, itemIdValue, reasonValue, idempotencyKey,
) {
  const operation = itemOwner({ scope: 'operation', id: operationIdValue });
  const to = itemOwner(toOwnerValue, { allowOperation: false });
  const itemId = boundedText(itemIdValue, 'Item id', 200);
  const reason = mutationReason(reasonValue);
  return executeMutation(client, 'release_escrow', operation, idempotencyKey,
    { to, itemId, reason }, async (guard, eventKey) => {
      const current = await lockedItem(client, itemId);
      if (!current || current.state !== 'escrowed'
        || current.owner_scope !== 'operation' || current.owner_id !== operation.id) {
        fail('item_not_escrowed', 'That operation does not hold this item escrow.');
      }
      const custody = (await client.query(
        `SELECT item_id, owner_scope, operation_id, item_state,
                depositor_scope, depositor_id, created_at
           FROM operation_escrow WHERE item_id=$1 FOR UPDATE`, [itemId],
      )).rows[0];
      if (!custody || custody.operation_id !== operation.id) {
        fail('item_not_escrowed', 'That operation does not hold this item escrow.');
      }
      registerItemRestore(client, current, custody);
      const removed = await client.query(
        'DELETE FROM operation_escrow WHERE item_id=$1 AND operation_id=$2',
        [itemId, operation.id],
      );
      if (removed.rowCount !== 1) {
        fail('contention', 'The item escrow changed; retry the operation.');
      }
      const changed = await client.query(
        `UPDATE item_instances
            SET owner_scope=$2, owner_id=$3, state='active', updated_at=now()
          WHERE id=$1 AND owner_scope='operation' AND owner_id=$4 AND state='escrowed'
          RETURNING id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at`,
        [itemId, to.scope, to.id, operation.id],
      );
      if (changed.rowCount !== 1) {
        fail('contention', 'The item escrow changed; retry the operation.');
      }
      await appendEvent(client, guard, {
        eventKey, eventKind: 'released', provenanceKind: 'transferred',
        itemId, templateId: current.template_id,
        from: operation, to, reason,
      });
      return itemProjection(changed.rows[0]);
    });
}

/** Read current spendable stacks and unique instances exactly once from their authoritative rows. */
export async function inventoryBoard(client, ownerValue) {
  if (!client || typeof client.query !== 'function') {
    fail('item_transaction_required', 'Inventory read requires a database query client.');
  }
  // Waiting on the module-wide pg-mem tail prevents pool/client aliases from observing a
  // compensatable partial write. A read made inside the active branded transaction skips the wait,
  // avoiding self-deadlock.
  await waitForPgMemTransactions(client);
  const owner = itemOwner(ownerValue);
  const stacks = (await client.query(
    `SELECT template_id, quality, quantity, created_at, updated_at
       FROM item_stacks
      WHERE owner_scope=$1 AND owner_id=$2 AND quantity>0
      ORDER BY template_id, quality`,
    [owner.scope, owner.id],
  )).rows.map((row) => ({
    templateId: row.template_id,
    quality: row.quality,
    qty: Number(row.quantity),
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
  }));
  const items = (await client.query(
    `SELECT id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at
       FROM item_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND state<>'consumed'
      ORDER BY created_at, id`,
    [owner.scope, owner.id],
  )).rows.map(itemProjection);
  return { owner, stacks, items };
}
