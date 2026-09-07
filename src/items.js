// Conserved inventory primitives for authored world graphs.
//
// Mutation callers enter through withItemTransaction and receive its branded client. That lets a
// recipe, salvage, mystery, or social operation lock its authority rows and inventory rows under one
// module-owned COMMIT. Every mutation reserves a globally unique logical key, applies conditional
// DML, appends provenance, and completes the replay result inside that boundary.
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { types } from 'node:util';
import { dbCaps } from './db.js';
import { GameError } from './game.js';
import { withPhase2Read, assertPhase2Client } from './content/phase2-transactions.js';
import { canonicalBytes } from './content/canonical.js';
import { compareItemLockEntries } from './item-lock-trace.js';

const OWNER_SCOPES = new Set(['character', 'account', 'operation']);
const COMPOSITE_MUTATION_KINDS = new Set([
  'assign_current_character', 'craft', 'salvage_car', 'mystery_action', 'operation_action',
  'reward_claim',
]);
const CREATION_PROVENANCE_KINDS = new Set(['crafted', 'salvaged', 'awarded', 'imported']);
const ESCROW_PROVENANCE_KINDS = new Set(['used_in_mystery', 'used_in_operation']);
const MUTATION_CONTEXTS = new WeakMap();
const ITEM_TRANSACTIONS = new WeakMap();
const TRANSACTION_SCOPE = new AsyncLocalStorage();
const READ_SCOPE = new AsyncLocalStorage();
let PG_MEM_TRANSACTION_TAIL = Promise.resolve();
let PG_MEM_RECOVERY_REQUIRED = false;
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

export function assertItemTransaction(client) { transactionClient(client); }
function mutationState(client, token) {
  const transaction = transactionClient(client);
  const state = token && typeof token === 'object' ? MUTATION_CONTEXTS.get(token) : null;
  if (!state || state.closed || state.client !== client || state.transaction !== transaction) {
    fail('item_transaction_required', 'Item mutation requires its active private root token.');
  }
  return state;
}
export function itemMutationContext(client, token) {
  const { guard } = mutationState(client, token);
  return Object.freeze({ key: guard.key, mutationId: guard.mutationId, envelopeVersion: guard.envelopeVersion });
}
export function nextItemMutationOrdinal(client, token) {
  return mutationState(client, token).ioOrdinal++;
}
export function assertLotCandidateRoot(client, token, value) {
  const state = mutationState(client, token);
  const root = snapshotLotRequest(value);
  closedObject(root, ['owner', 'authority']);
  if (state.guard.envelopeVersion !== 2 || !state.lotRoot) {
    fail('item_transaction_required', 'Exact lots require an active Phase 2 item root.');
  }
  if (!canonicalBytes(root).equals(canonicalBytes(state.lotRoot))) {
    fail('bad_item_request', 'Item candidates contradict their pinned root.');
  }
}
export function assertLotDefinitionPin(client, token, value) {
  const state = mutationState(client, token);
  const input = snapshotLotRequest(value);
  closedObject(input, ['owner', 'definitionHash', 'direction']);
  closedObject(input.owner, ['scope', 'id']);
  if (state.guard.envelopeVersion !== 2 || !state.lotRoot) {
    fail('item_transaction_required', 'Exact lots require an active Phase 2 item root.');
  }
  if (!['input', 'output'].includes(input.direction)
    || !canonicalBytes(input.owner).equals(canonicalBytes(state.lotRoot.owner))
    || typeof input.definitionHash !== 'string'
    || !state.lotRoot.authority[`${input.direction}DefinitionHashes`].includes(input.definitionHash)) {
    fail('bad_item_request', 'Item identity contradicts its pinned root.');
  }
}
export function assertAndUseLotTransition(client, token, transitionIndex, value) {
  const state = mutationState(client, token);
  try {
    const entries = state.lotRoot?.authority.itemTransitions;
    if (state.guard.envelopeVersion !== 2 || !Array.isArray(entries)) {
      fail('item_mutation_authority', 'This root has no exact transition authority.');
    }
    if (!Number.isSafeInteger(transitionIndex) || transitionIndex < 0 || transitionIndex >= entries.length) {
      fail('bad_item_request', 'Invalid exact transition index.');
    }
    if (!canonicalBytes(snapshotLotRequest(value)).equals(canonicalBytes(entries[transitionIndex]))) {
      fail('bad_item_request', 'Exact transition contradicts its pinned root.');
    }
    if (state.usedLotTransitions.has(transitionIndex)) fail('contention', 'Exact transition was already used.');
    state.usedLotTransitions.add(transitionIndex);
  } catch (error) { state.failed ||= error; poisonItemTransaction(client, error); throw error; }
}
export function poisonItemTransaction(client, error) {
  const transaction = transactionClient(client);
  transaction.failed ||= error || new GameError('bad_item_request', 'Item mutation failed.');
}
function recoveryRequired() {
  if (!dbCaps.skipLocked && PG_MEM_RECOVERY_REQUIRED) {
    fail('item_recovery_required', 'Item recovery requires a fresh database process.');
  }
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
  for (const [key, reservationId] of transaction.guardReservations) {
    const row = (await client.query('SELECT reservation_id FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];
    if (row?.reservation_id === reservationId) {
      const root = (await client.query('SELECT mutation_id FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];
      if (root.mutation_id) {
        await client.query('DELETE FROM item_mutation_outputs WHERE mutation_id=$1', [root.mutation_id]);
        await client.query('DELETE FROM item_mutation_inputs WHERE mutation_id=$1', [root.mutation_id]);
      }
      await client.query('DELETE FROM item_events WHERE idempotency_key=$1', [key]);
    }
  }
  for (let i = transaction.undo.length - 1; i >= 0; i--) await transaction.undo[i]();
  for (const [key, reservationId] of transaction.guardReservations) {
    await client.query('DELETE FROM item_mutation_guards WHERE idempotency_key=$1 AND reservation_id=$2', [key, reservationId]);
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
  if (PG_MEM_RECOVERY_REQUIRED) { releaseGate(); recoveryRequired(); }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseGate();
    if (PG_MEM_TRANSACTION_TAIL === tail) PG_MEM_TRANSACTION_TAIL = Promise.resolve();
  };
}

async function waitForPgMemTransactions(queryable) {
  recoveryRequired();
  if (dbCaps.skipLocked) return;
  const transaction = ITEM_TRANSACTIONS.get(queryable);
  if (transaction && TRANSACTION_SCOPE.getStore()?.transaction === transaction) return;
  // All external pg-mem readers join the same barrier regardless of whether their query handle is
  // the pool, a checked-out adapter, a Proxy, or a forwarding alias. This prevents identity aliases
  // from observing writes which the active boundary may still compensate.
  await PG_MEM_TRANSACTION_TAIL;
  recoveryRequired();
}

export async function withItemRead(queryable, action) {
  recoveryRequired();
  const transaction = queryable && ITEM_TRANSACTIONS.get(queryable);
  if ((transaction?.active && TRANSACTION_SCOPE.getStore()?.transaction === transaction)
    || (READ_SCOPE.getStore()?.client === queryable && READ_SCOPE.getStore()?.active)) return action(queryable);
  // Preserve arrival behind already queued legacy writers before entering the composed read.
  // The callback itself is still protected for its entire duration by both gates below.
  if (!registryContext(queryable)) await waitForPgMemTransactions(queryable);
  return withPhase2Read(queryable, async (client) => {
    const release = await acquirePgMemTransaction();
    const scope = { client, active: true };
    try { return await READ_SCOPE.run(scope, () => action(client)); }
    finally { scope.active = false; release(); }
  });
}

function registryContext(client) {
  try { assertPhase2Client(client); return true; }
  catch (error) { if (error?.code !== 'content_transaction_required') throw error; return false; }
}

function itemFailure(error, rolledBack) {
  if (['40001', '40P01', '55P03'].includes(error?.code) || (error?.code === '57014' && rolledBack)) {
    return new GameError('contention', 'Item transaction must be retried.');
  }
  if (/^(?:22|23|25)[0-9A-Z]{3}$/.test(error?.code ?? '')) {
    return new GameError('item_integrity_error', 'Item transaction failed its database constraints.');
  }
  return error;
}

/**
 * Keep non-item projections from observing a compensatable pg-mem write in another async flow.
 * Real PostgreSQL uses MVCC and this is a no-op there; callers inside the active branded item
 * transaction also skip the wait to avoid self-deadlock.
 */
export async function awaitItemReadBarrier(queryable) {
  if (!queryable || typeof queryable.query !== 'function') {
    fail('item_transaction_required', 'The item read barrier requires a database query client.');
  }
  await waitForPgMemTransactions(queryable);
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
  if (TRANSACTION_SCOPE.getStore() || registryContext(pool) || READ_SCOPE.getStore()?.active) {
    fail('item_transaction_nested', 'Item transactions cannot be nested; reuse the active client.');
  }
  return TRANSACTION_SCOPE.run({ active: true }, async () => {
    const scope = TRANSACTION_SCOPE.getStore();
    let client = null, discard = false, begun = false, outcome, borrowed = false;
    const transaction = { active: false, failed: null, guardReservations: [], undo: [] };
    // Keep all raw failures inside the item owner. The registry wrapper sees a private outcome,
    // never a raw SQLSTATE that it could remap before rollback/commit disposition is known.
    async function ownedAction() {
      let release = () => {}, committing = false;
      try {
        release = await acquirePgMemTransaction();
        if (!begun) { await client.query('BEGIN'); begun = true; }
        transaction.active = true;
        ITEM_TRANSACTIONS.set(client, transaction); scope.transaction = transaction;
        const result = await action(client);
        if (transaction.failed) throw transaction.failed;
        committing = true;
        await client.query('COMMIT');
        outcome = { result };
      } catch (error) {
        let failure = error, rolledBack = false;
        const definite = /^[0-9A-Z]{5}$/.test(error?.code ?? '') && !/^(08|57P)/.test(error.code);
        if (committing && !definite) {
          discard = true;
          failure = new GameError('item_commit_unknown', 'Reconcile the exact item key on a fresh connection.');
        } else {
          try { await client.query('ROLLBACK'); rolledBack = true; } catch { discard = true; }
          if (!dbCaps.skipLocked && transaction.active) {
            try { await compensateItemTransaction(client, transaction); }
            catch {
              PG_MEM_RECOVERY_REQUIRED = true; discard = true;
              failure = new GameError('item_recovery_required', 'Item recovery requires a fresh database process.');
            }
          }
          if (!rolledBack && !PG_MEM_RECOVERY_REQUIRED) failure = new GameError('item_commit_unknown', 'Item rollback could not be confirmed.');
          else failure = itemFailure(failure, rolledBack);
        }
        outcome = { error: failure };
      } finally {
        transaction.active = false; ITEM_TRANSACTIONS.delete(client);
        release();
      }
    }
    try {
      recoveryRequired();
      client = await pool.connect();
      if (registryContext(client)) {
        borrowed = true;
        fail('item_transaction_nested', 'Registry callbacks cannot start item transactions.');
      }
      if (dbCaps.skipLocked) { await client.query('BEGIN'); begun = true; }
      await withPhase2Read(client, ownedAction);
    } catch (error) {
      let rolledBack = false;
      if (client && !outcome && !registryContext(client)) {
        try { await client.query('ROLLBACK'); rolledBack = true; } catch { discard = true; }
      }
      outcome = { error: error?.code === 'content_transaction_nested'
        ? new GameError('item_transaction_nested', 'Registry callbacks cannot start item transactions.')
        : discard ? new GameError('item_commit_unknown', 'Item rollback could not be confirmed.') : itemFailure(error, rolledBack) };
    } finally {
      transaction.active = false;
      if (client && !borrowed) {
        ITEM_TRANSACTIONS.delete(client);
        client.release(discard);
      }
    }
    if (outcome.error) throw outcome.error;
    return outcome.result;
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
  return reserveMutation(client, { key, kind, owner, requestHash, envelopeVersion: 1 });
}

async function reserveMutation(client, { key, kind, owner, requestHash, envelopeVersion,
  actorAccountId = null, externalKey = null, requestJson = null }) {
  await activeTransaction(client);
  const reservationId = crypto.randomUUID();
  const mutationId = crypto.randomUUID();
  const matches = (row) => row && row.envelope_version === envelopeVersion && row.mutation_kind === kind
    && row.owner_scope === owner.scope && row.owner_id === owner.id && row.request_hash === requestHash
    && (envelopeVersion === 1 || (row.actor_account_id === actorAccountId && row.external_key === externalKey
      && row.request_json === requestJson));
  const replay = (row) => {
    if (!matches(row)) fail('idempotency_conflict', 'That item key is bound to another mutation.');
    if (row.result_json != null) return { key, replay: JSON.parse(row.result_json), completed: true,
      mutationId: row.mutation_id, envelopeVersion };
    return null;
  };
  // A completed receipt is immutable and can be resolved without descending from a guard lock.
  const prior = (await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];
  if (prior) { const result = replay(prior); if (result) return result; }
  // Track reservation intent before the insertion acknowledgement can be lost. Compensation uses
  // the reservation UUID too, so a losing reservation can never delete another receipt.
  // Keep every attempt: a before-write failure can leave an unused first UUID, while
  // a lost acknowledgement can leave the first UUID owning the row. Neither a first-
  // nor last-only slot can safely identify all writes after caught same-key retries.
  transactionClient(client).guardReservations.push([key, reservationId]);
  await client.query(
    `INSERT INTO item_mutation_guards
       (idempotency_key, mutation_kind, owner_scope, owner_id, request_hash, reservation_id,
        envelope_version, mutation_id, actor_account_id, external_key, request_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [key, kind, owner.scope, owner.id, requestHash, reservationId, envelopeVersion, mutationId, actorAccountId, externalKey, requestJson],
  );
  const row = (await client.query(
    `SELECT *
       FROM item_mutation_guards WHERE idempotency_key=$1 FOR UPDATE`,
    [key],
  )).rows[0];
  const completed = replay(row);
  if (completed) return completed;
  if (row.reservation_id !== reservationId) {
    fail('idempotency_in_progress', 'That item mutation is still in progress.');
  }
  return { key, reservationId, replay: null, completed: false, mutationId, envelopeVersion };
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
  // Social-operation completion may atomically award different participants. The operation module
  // binds those server-resolved account destinations into the fresh execution authority envelope.
  // Other mutation kinds retain the root-owner-only rule, and an undeclared destination remains
  // impossible even for an operation action.
  if (kind === 'create_item' && composite.mutationKind === 'operation_action'
    && composite.authority.destinations.has(ownerKey(owner))) return;
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
  const transaction = transactionClient(client);
  const composite = key && typeof key === 'object' ? MUTATION_CONTEXTS.get(key) : null;
  if (transaction.mutation && composite !== transaction.mutation) {
    fail('item_mutation_nested', 'Reuse the active item mutation token.');
  }
  if (composite) {
    if (composite.client !== client || composite.closed) {
      fail('item_transaction_required', 'That item mutation context is not active on this transaction.');
    }
    try {
      assertCompositeAuthority(composite, kind, owner, request);
      composite.ordinal += 1;
      nextItemMutationOrdinal(client, key);
      return await action(
        composite.guard, `${String(composite.ordinal).padStart(4, '0')}:${kind}`,
      );
    } catch (error) {
      composite.failed = error;
      transactionClient(client).failed ||= error;
      throw error;
    }
  }
  try {
    if (key && typeof key === 'object') fail('item_transaction_required', 'Invalid item mutation token.');
    const guard = await beginMutation(client, kind, owner, key, request);
    if (guard.completed) return guard.replay;
    const result = await action(guard, 'result');
    return await completeMutation(client, guard, result);
  } catch (error) {
    transactionClient(client).failed ||= error;
    throw error;
  }
}

// One logical action may consume several stacks and create/escrow several instances. The opaque
// context lets those leaf primitives share exactly one guard and append distinct ordinal events;
// replay returns the aggregate result without entering `action` at all. withItemTransaction owns the
// surrounding BEGIN/COMMIT/ROLLBACK and pg-mem compensation boundary.
async function withItemMutationImpl(
  client, ownerValue, mutationKindValue, idempotencyKey, request, action,
) {
  const transaction = transactionClient(client);
  if (transaction.mutation) fail('item_mutation_nested', 'Reuse the active item mutation token.');
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
  const authorityInput = requestHashInput.itemAuthority;
  // itemAuthority is server-derived execution capability, not client-nominated logical input. It
  // may legitimately change between an action and its exact replay (for example, more participants
  // may join an operation), so binding it into the replay digest would turn a successful retry into
  // idempotency_conflict. A replay returns before executing any leaf mutation; a fresh execution
  // still receives and enforces only the authority derived for that request.
  delete requestHashInput.itemAuthority;
  const guard = await beginMutation(
    client, mutationKind, owner, idempotencyKey, requestHashInput,
  );
  if (guard.completed) return guard.replay;
  return runMutation(client, guard, owner, mutationKind, () => compositeAuthority({ itemAuthority: authorityInput }), action);
}

async function runMutation(client, guard, owner, mutationKind, authority, action, lotRoot = null) {
  const context = Object.freeze({});
  const state = {
    client, guard, rootOwner: owner, authority: null, mutationKind, transaction: transactionClient(client),
    ordinal: 0, ioOrdinal: 0, closed: false, failed: null, lotRoot, usedLotTransitions: new Set(),
  };
  MUTATION_CONTEXTS.set(context, state);
  state.transaction.mutation = state;
  try {
    state.authority = authority();
    const result = await action(context);
    if (state.failed) throw state.failed;
    if (lotRoot) {
      if (state.usedLotTransitions.size !== (lotRoot.authority.itemTransitions?.length || 0)) {
        fail('item_mutation_authority', 'Every declared exact transition must be applied.');
      }
      const { assertLotMutationParity } = await import('./itemlots.js');
      await assertLotMutationParity(client, context);
    }
    state.closed = true;
    return await completeMutation(client, guard, result);
  } catch (error) {
    state.closed = true;
    transactionClient(client).failed ||= error;
    throw error;
  } finally { state.closed = true; state.transaction.mutation = null; }
}

// Task 3's seven hash domains remain closed. This private, string-only framing uses the same
// typed/length-prefixed wire format for the separate item-key domain; it grants no registry authority.
function lotStorageKey(actorAccountId, actionKind, externalKey) {
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
  const domain = Buffer.from('omerta:item-mutation-key:v1');
  const parts = [Buffer.from('OMERTA\0'), u32(domain.length), domain, u32(3)];
  for (const [name, value] of [['actorAccountId', actorAccountId], ['actionKind', actionKind], ['externalKey', externalKey]]) {
    const field = Buffer.from(name), payload = Buffer.from(value);
    parts.push(u32(field.length), field, Buffer.from([4]), u64(payload.length), payload);
  }
  return crypto.createHash('sha256').update(Buffer.concat(parts)).digest('hex');
}

function closedObject(value, keys) {
  if (!value || Array.isArray(value) || typeof value !== 'object'
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    fail('bad_item_request', 'Item authority must have exactly its declared fields.');
  }
}

function snapshotLotRequest(value) {
  // Inspect descriptors before encoding: getters, proxies, cycles and oversized trees are not data.
  const seen = new WeakSet(); let members = 0, textBytes = 0;
  function inspect(node, depth) {
    if (++members > 4096 || depth > 32) fail('bad_item_request', 'Item authority exceeds its data bounds.');
    if (typeof node === 'string') { textBytes += Buffer.byteLength(node); }
    if (textBytes > 65536) fail('bad_item_request', 'Item authority exceeds its data bounds.');
    if (!node || typeof node !== 'object') return;
    if (types.isProxy(node) || seen.has(node)) fail('bad_item_request', 'Item authority must be inert canonical data.');
    seen.add(node);
    const descriptors = Object.getOwnPropertyDescriptors(node);
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value') || typeof key !== 'string') fail('bad_item_request', 'Item authority must be inert canonical data.');
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('bad_item_request', 'Item authority contains a prohibited property name.');
      textBytes += Buffer.byteLength(key); inspect(descriptor.value, depth + 1);
    }
    seen.delete(node);
  }
  try { inspect(value, 0); return JSON.parse(canonicalBytes(value).toString('utf8')); }
  catch (error) { if (error instanceof GameError) throw error; fail('bad_item_request', 'Item authority must be inert canonical data.'); }
}

function validateLotTransitions(authority) {
  const entries = authority.itemTransitions;
  if (!Array.isArray(entries) || entries.length > 256) fail('bad_item_request', 'Invalid exact transition list.');
  const bad = () => fail('bad_item_request', 'Invalid exact transition authority.');
  const hash = (value) => { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) bad(); };
  const owner = (value, direct = false) => {
    closedObject(value, ['scope', 'id']);
    if (!(direct ? ['account', 'character'] : ['account', 'character', 'operation']).includes(value.scope)) bad();
    boundedText(value.id, 'Transition owner', 200);
  };
  const opaque = (value, nullable = true) => {
    if (nullable && value === null) return;
    if (typeof value !== 'string' || Buffer.byteLength(value) > 128 || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value)) bad();
  };
  let previous;
  for (const entry of entries) {
    const keys = { escrow: ['kind', 'subject', 'operationId'], release: ['kind', 'subject', 'depositor'],
      consume_unique: ['kind', 'subject', 'depositor'], consume_escrow_lot: ['kind', 'subject', 'depositor'],
      transfer_unique: ['kind', 'subject', 'destination'] };
    if (!entry || !Object.hasOwn(keys, entry.kind)) bad();
    closedObject(entry, keys[entry.kind]);
    const subject = entry.subject;
    if (!subject || !['lot', 'unique'].includes(subject.storageKind)) bad();
    const idName = subject.storageKind === 'lot' ? 'lotId' : 'itemId';
    closedObject(subject, ['storageKind', idName, 'expected']);
    boundedText(subject[idName], 'Transition subject', 200);
    const lock = { className: 'item', subtype: subject.storageKind, key: subject[idName], id: subject[idName], generation: 0 };
    if (previous && compareItemLockEntries(previous, lock) >= 0) bad();
    previous = lock;
    const expected = subject.expected;
    closedObject(expected, subject.storageKind === 'lot'
      ? ['logicalItemId', 'definitionHash', 'owner', 'custody', 'qualityBand', 'qualityStateDigest', 'tradePolicyHash',
        'binding', 'transferRestriction', 'seasonId', 'runId', 'sourceCapId', 'expiresAt', 'ageBasisAt', 'provenanceCoalescingClass', 'remainingQuantity']
      : ['definitionHash', 'owner', 'state', 'custody', 'qualityBand', 'qualityStateDigest', 'conditionSummary', 'exportPolicy']);
    hash(expected.definitionHash);
    if (!authority.inputDefinitionHashes.includes(expected.definitionHash)) bad();
    owner(expected.owner);
    closedObject(expected.custody, ['state', 'scope', 'id']);
    const escrowed = expected.custody.state === 'escrowed';
    if (escrowed) {
      if (expected.custody.scope !== 'operation' || expected.owner.scope !== 'operation'
        || expected.custody.id !== expected.owner.id) bad();
    } else if (expected.custody.state !== 'direct' || expected.custody.scope !== null
      || expected.custody.id !== null || expected.owner.scope === 'operation') bad();
    if (expected.qualityBand !== null) boundedText(expected.qualityBand, 'Exact quality', 80);
    if (expected.qualityStateDigest !== null) hash(expected.qualityStateDigest);
    if (subject.storageKind === 'lot') {
      boundedText(expected.logicalItemId, 'Exact logical item', 200); hash(expected.tradePolicyHash);
      if (expected.tradePolicyHash !== expected.definitionHash) bad();
      if (!Number.isSafeInteger(expected.remainingQuantity) || expected.remainingQuantity < 1 || expected.remainingQuantity > 1000000) {
        fail('qty', 'Invalid pinned lot quantity.');
      }
      opaque(expected.binding); opaque(expected.transferRestriction); opaque(expected.provenanceCoalescingClass, false);
      for (const name of ['seasonId', 'runId', 'sourceCapId']) if (expected[name] !== null) boundedText(expected[name], 'Exact lot identity', 200);
      for (const name of ['expiresAt', 'ageBasisAt']) if (expected[name] !== null
        && (typeof expected[name] !== 'string' || !Number.isFinite(Date.parse(expected[name]))
          || new Date(expected[name]).toISOString() !== expected[name])) bad();
    } else if (expected.state !== (escrowed ? 'escrowed' : 'active')
      || expected.conditionSummary !== null || expected.exportPolicy !== 'ineligible') bad();
    if (['consume_unique', 'transfer_unique'].includes(entry.kind) && subject.storageKind !== 'unique') bad();
    if (entry.kind === 'consume_escrow_lot' && subject.storageKind !== 'lot') bad();
    if (entry.kind === 'escrow') boundedText(entry.operationId, 'Exact operation', 200);
    if (entry.kind === 'transfer_unique') owner(entry.destination, true);
    if (['release', 'consume_escrow_lot'].includes(entry.kind) || (entry.kind === 'consume_unique' && entry.depositor !== null)) owner(entry.depositor, true);
  }
}

export async function withLotMutation(client, value, action) {
  const transaction = transactionClient(client);
  try {
    if (transaction.mutation) fail('item_mutation_nested', 'Reuse the active item mutation token.');
    const input = snapshotLotRequest(value);
    closedObject(input, ['actorAccountId', 'actionKind', 'idempotencyKey', 'owner', 'request']);
    closedObject(input.owner, ['scope', 'id']);
    const owner = itemOwner(input.owner), kind = input.actionKind;
    const account = boundedText(input.actorAccountId, 'Actor account', 200);
    const externalKey = logicalKey(input.idempotencyKey);
    if (!COMPOSITE_MUTATION_KINDS.has(kind) || typeof action !== 'function') fail('bad_item_request', 'Unsupported lot action.');
    closedObject(input.request, ['input', 'authority']);
    const authority = input.request.authority;
    const authorityKeys = ['issuedActionId', 'aggregate', 'resolvedOwner', 'bundleHash', 'namespace',
      'activationRevision', 'eventId', 'inputDefinitionHashes', 'outputDefinitionHashes'];
    const extended = authority !== null && typeof authority === 'object' && Object.hasOwn(authority, 'itemTransitions');
    closedObject(authority, extended ? [...authorityKeys, 'itemTransitions'] : authorityKeys);
    closedObject(authority.aggregate, ['kind', 'id']); closedObject(authority.resolvedOwner, ['scope', 'id']);
    itemOwner(authority.resolvedOwner);
    for (const text of [authority.issuedActionId, authority.aggregate.kind, authority.aggregate.id,
      authority.namespace, authority.eventId]) boundedText(text, 'Authority identity', 200);
    if (!Number.isSafeInteger(authority.activationRevision) || authority.activationRevision < 1
      || typeof authority.bundleHash !== 'string' || !/^[0-9a-f]{64}$/.test(authority.bundleHash)) fail('bad_item_request', 'Invalid item selection authority.');
    for (const name of ['inputDefinitionHashes', 'outputDefinitionHashes']) {
      const hashes = authority[name];
      if (!Array.isArray(hashes) || hashes.length > 256
        || hashes.some((hash) => typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash))) {
        fail('bad_item_request', 'Invalid exact definition pins.');
      }
      hashes.sort();
      if (new Set(hashes).size !== hashes.length) fail('bad_item_request', 'Exact definition pins must be duplicate-free.');
    }
    if (extended) validateLotTransitions(authority);
    const requestJson = canonicalBytes({ owner, request: input.request }).toString('utf8');
    const guard = await reserveMutation(client, { key: lotStorageKey(account, kind, externalKey), kind, owner,
      requestHash: crypto.createHash('sha256').update(requestJson).digest('hex'), envelopeVersion: 2,
      actorAccountId: account, externalKey, requestJson });
    if (guard.completed) return guard.replay;
    if (!canonicalBytes(owner).equals(canonicalBytes(authority.resolvedOwner))) {
      fail('bad_item_request', 'Exact root owner must match its resolved owner.');
    }
    return await runMutation(client, guard, owner, kind, () => ({ destinations: new Set(), operations: new Set() }), action,
      { owner, authority });
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}

async function appendEvent(client, guard, {
  eventKey, eventKind, provenanceKind = null, itemId = null, templateId, quantityDelta = null,
  quality = 'standard', quantityBefore = null, quantityAfter = null, from = null, to = null, reason,
}) {
  await client.query(
    `INSERT INTO item_events
       (id, event_key, event_kind, provenance_kind, item_id, template_id, quality,
        quantity_delta, quantity_before, quantity_after,
        from_owner_scope, from_owner_id, to_owner_scope, to_owner_id, reason, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [crypto.randomUUID(), eventKey, eventKind, provenanceKind, itemId, templateId, quality,
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
  // Exact attachments (including migration observations) mutate only through the exact plan/leaf.
  // The attachment CHECK makes a null definition hash the all-null legacy branch. Filtering here
  // preserves each legacy caller's absent-subject error and completed-receipt replay before lookup.
  return (await client.query(
    `SELECT id, template_id, owner_scope, owner_id, state, created_at, updated_at, consumed_at
       FROM item_instances WHERE id=$1 AND definition_hash IS NULL FOR UPDATE`,
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
async function grantStackImpl(
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
        eventKey, eventKind: 'stack_granted', templateId, quality, quantityDelta: qty,
        quantityBefore: before, quantityAfter: after, to: owner, reason,
      });
      return { owner, templateId, quality, qty: after, delta: qty };
    });
}

/** Consume a fungible stack quantity under a row lock and nonnegative conditional update. */
async function consumeStackImpl(
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
        eventKey, eventKind: 'stack_consumed', templateId, quality, quantityDelta: -qty,
        quantityBefore: before, quantityAfter: after, from: owner, reason,
      });
      return { owner, templateId, quality, qty: after, delta: -qty };
    });
}

/** Create one unique/stateful item with a permanent server-generated ID. */
async function createItemImpl(
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
async function transferItemImpl(
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
async function consumeItemImpl(
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
async function escrowItemImpl(
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
async function releaseEscrowImpl(
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
      if (custody.depositor_scope !== to.scope || custody.depositor_id !== to.id) {
        fail('item_escrow_destination', 'Escrow may be released only to its recorded depositor.');
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

// Validation is part of the leaf, too: a caller cannot catch malformed quantities/owners and
// commit earlier writes. Keep this outside the implementations so their historical digest order stays intact.
function itemLeaf(implementation) {
  return async (client, ...args) => {
    transactionClient(client);
    try { return await implementation(client, ...args); }
    catch (error) { poisonItemTransaction(client, error); throw error; }
  };
}
export const grantStack = itemLeaf(grantStackImpl);
export const withItemMutation = itemLeaf(withItemMutationImpl);
export const consumeStack = itemLeaf(consumeStackImpl);
export const createItem = itemLeaf(createItemImpl);
export const transferItem = itemLeaf(transferItemImpl);
export const consumeItem = itemLeaf(consumeItemImpl);
export const escrowItem = itemLeaf(escrowItemImpl);
export const releaseEscrow = itemLeaf(releaseEscrowImpl);

/** Read current spendable stacks and unique instances exactly once from their authoritative rows. */
export async function inventoryBoard(client, ownerValue) {
  if (!client || typeof client.query !== 'function') {
    fail('item_transaction_required', 'Inventory read requires a database query client.');
  }
  return withItemRead(client, (q) => collectInventory(q, ownerValue));
}
async function collectInventory(client, ownerValue) {
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
