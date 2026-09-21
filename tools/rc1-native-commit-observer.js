// Optional test-only observation of serialized native SQL boundaries.
// It never invents receipts, rewrites SQL, or serializes concurrent writers.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export function createNativeCommitObserver({ onBoundary, onAttempt = async () => {}, context = () => null }) {
  assert.equal(typeof onBoundary, 'function');
  const clients = new WeakMap(), transactions = new Map(), failures = [];
  let armed = false, busy = false, nextClient = 0, sequence = 0, nextTransaction = 0;
  const unsupported = (message) => {
    const error = Error(message); error.code = 'RC1_COMMIT_OBSERVER_UNSUPPORTED';
    failures.push({ message }); return error;
  };
  return {
    arm() { assert(!armed && !busy); armed = true; },
    disarm() { assert(!busy); assert.equal(transactions.size, 0, 'Unfinished observed transaction'); armed = false; },
    diagnostic() { return { armed, busy, observedQueries: sequence, openTransactions: [...transactions.values()], failures }; },
    assertComplete() { assert(!busy); assert.equal(transactions.size, 0); assert.equal(failures.length, 0, JSON.stringify(failures)); },
    wrapQuery(client, query) {
      if (!clients.has(client)) clients.set(client, ++nextClient);
      const clientId = clients.get(client);
      return async (sql, values) => {
        if (!armed) return query(sql, values);
        if (busy) throw unsupported('Concurrent native queries cannot claim an isolated per-commit snapshot');
        const text = typeof sql === 'string' ? sql : sql.text;
        // A single driver response cannot expose intermediate commits. Reject
        // ambiguous text before execution, including semicolons in SQL literals.
        if (typeof text !== 'string' || text.trim().replace(/;$/, '').includes(';'))
          throw unsupported('Observed SQL must contain one statement with at most one trailing semicolon');
        busy = true;
        const entry = { sequence: ++sequence, clientId, context: structuredClone(context()),
          sqlSha256: crypto.createHash('sha256').update(text).digest('hex') };
        const dispatch = async (callback, payload, phase) => {
          try { await callback(payload); }
          catch (error) {
            failures.push({ sequence: entry.sequence, message: error.message, phase, nativeReturned });
            error.rc1ObserverError = true; throw error;
          }
        };
        const begins = /^\s*(?:BEGIN|START\s+TRANSACTION)\b/i.test(text);
        const rollbackTo = /^\s*ROLLBACK\s+TO\b/i.test(text);
        let nativeReturned = false;
        try {
          const result = await query(sql, values); nativeReturned = true;
          if (Array.isArray(result)) throw unsupported('Multiple PostgreSQL results cannot identify every committed boundary');
          const tag = result.command;
          if (begins) {
            if (transactions.has(clientId)) throw unsupported('Nested BEGIN has no independent native transaction');
            transactions.set(clientId, { id: ++nextTransaction, clientId, firstQuery: entry.sequence });
          }
          const transaction = transactions.get(clientId);
          await dispatch(onAttempt, { ...entry, transactionId: transaction?.id || null, outcome: 'RETURNED', command: tag }, 'attempt');
          if (rollbackTo || ['SAVEPOINT', 'RELEASE'].includes(tag)) return result;
          if (tag === 'COMMIT' || tag === 'ROLLBACK') {
            if (!transaction) throw unsupported('Observed transaction ended without an observed BEGIN');
            transactions.delete(clientId);
            await dispatch(onBoundary, { ...entry, transactionId: transaction.id,
              outcome: tag === 'COMMIT' ? 'COMMITTED' : 'ROLLED_BACK', command: tag }, 'boundary');
          } else if (!transaction) {
            // Includes SELECT: SQL function calls can write. The read-only
            // observer connection must bypass this wrapper to avoid recursion.
            await dispatch(onBoundary, { ...entry, transactionId: null, outcome: 'AUTOCOMMITTED', command: tag }, 'boundary');
          }
          return result;
        } catch (error) {
          if (!nativeReturned) {
            await dispatch(onAttempt, { ...entry, transactionId: transactions.get(clientId)?.id || null,
              outcome: 'THREW', code: error.code || error.name }, 'attempt');
            if (!transactions.has(clientId)) await dispatch(onBoundary, { ...entry, transactionId: null,
              outcome: 'STATEMENT_ABORTED', command: null }, 'boundary');
          } else {
            // SQL may already be durable. A failed observer must not relabel a
            // committed mutation as an aborted gameplay transaction.
            if (!error.rc1ObserverError) failures.push({ sequence: entry.sequence, message: error.message, nativeReturned: true });
            error.rc1ObservationAfterNativeReturn = true;
          }
          throw error;
        } finally { busy = false; }
      };
    },
  };
}
