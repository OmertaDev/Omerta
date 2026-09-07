import { AsyncLocalStorage } from 'node:async_hooks';
import { dbCaps } from '../db.js';
import { GameError } from '../game.js';

// Ephemeral authority for exactly one checked-out client and its async callback; never persisted.
const CONTEXTS = new WeakMap();
const SCOPE = new AsyncLocalStorage();
let tail = Promise.resolve();
let poisoned = false;
const failure = (code) => new GameError(code, 'Phase 2 registry operation could not complete.');

function context(client) {
  const active = client && CONTEXTS.get(client);
  if (!active || !active.active || SCOPE.getStore() !== active) {
    throw failure('content_transaction_required');
  }
  return active;
}
export function assertPhase2Client(client) { context(client); }
export function phase2ContextIdentity(client) { return context(client).identity; }
export function registerPhase2Undo(client, undo) {
  const active = context(client);
  if (!active.write || typeof undo !== 'function') throw failure('content_transaction_required');
  active.undo.push(undo);
}
async function acquire() {
  if (dbCaps.skipLocked) return () => {};
  const previous = tail;
  let release;
  tail = new Promise((resolve) => { release = resolve; });
  await previous;
  if (poisoned) { release(); throw failure('content_registry_recovery_required'); }
  return release;
}
function mapped(error, rolledBack) {
  if (['40001', '40P01', '55P03'].includes(error?.code)
      || (error?.code === '57014' && rolledBack)) return failure('contention');
  if (['23505', '23503', '23514', '23502', '25P02'].includes(error?.code)) {
    return failure('content_registry_corrupt');
  }
  return failure(typeof error?.code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(error.code)
    ? error.code : 'internal');
}

export async function withPhase2Transaction(pool, action) {
  if (!pool || typeof pool.connect !== 'function' || typeof action !== 'function') {
    throw failure('content_transaction_required');
  }
  if (SCOPE.getStore()) throw failure('content_transaction_nested');
  const active = { active: false, write: true, undo: [], identity: Object.freeze({}) };
  return SCOPE.run(active, async () => {
    const releaseGate = await acquire();
    let client, result, error, committing = false, discard = false, rolledBack = false, needsMapping = true;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      active.active = true;
      CONTEXTS.set(client, active);
      result = await action(client);
      committing = true;
      await client.query('COMMIT');
    } catch (original) {
      error = original;
      const definitiveSqlFailure = ['40001', '40P01', '55P03', '57014',
        '23505', '23503', '23514', '23502', '25P02'].includes(original?.code);
      if (committing && !definitiveSqlFailure) {
        // COMMIT may have succeeded. Never compensate an acknowledgement loss.
        error = failure('content_commit_unknown');
        needsMapping = false;
        discard = true;
      } else if (client) {
        try { await client.query('ROLLBACK'); rolledBack = true; } catch { discard = true; }
        if (!dbCaps.skipLocked && active.active) {
          try {
            for (let index = active.undo.length - 1; index >= 0; index--) await active.undo[index]();
          } catch (undoError) {
            poisoned = true;
            error = failure('content_registry_recovery_required');
            needsMapping = false;
            error.data = Object.freeze({ originalCode: safeCode(original), compensationCode: safeCode(undoError) });
          }
        }
        if (!poisoned && !rolledBack) { error = failure('content_commit_unknown'); needsMapping = false; }
      }
    } finally {
      active.active = false;
      if (client) { CONTEXTS.delete(client); client.release(discard); }
      if (error && needsMapping) error = mapped(error, rolledBack);
      releaseGate();
    }
    if (error) throw error;
    return result;
  });
}
function safeCode(error) {
  return typeof error?.code === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(error.code)
    ? error.code : 'operation_failed';
}

export async function withPhase2Read(queryable, action) {
  if (!queryable || typeof queryable.query !== 'function' || typeof action !== 'function') {
    throw failure('bad_content_request');
  }
  const existing = CONTEXTS.get(queryable);
  if (existing?.active && SCOPE.getStore() === existing) return action(queryable);
  if (SCOPE.getStore()) throw failure('content_transaction_nested');
  const active = { active: true, write: false, identity: Object.freeze({}) };
  return SCOPE.run(active, async () => {
    const releaseGate = await acquire();
    // A checked-out client participates in its caller's snapshot; pools own a snapshot here.
    const own = dbCaps.skipLocked && typeof queryable.connect === 'function'
      && typeof queryable.release !== 'function';
    let q = queryable, begun = false;
    try {
      if (own) {
        q = await queryable.connect();
        await q.query('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        begun = true;
      }
      CONTEXTS.set(q, active);
      const result = await action(q);
      if (own) await q.query('COMMIT');
      return result;
    } catch (error) {
      if (own && q !== queryable) await q.query('ROLLBACK').catch(() => {});
      throw mapped(error, false);
    } finally {
      active.active = false;
      CONTEXTS.delete(q);
      if (own && q !== queryable) q.release(!begun);
      releaseGate();
    }
  });
}
