// Optional test-only observation of serialized native SQL boundaries.
// It never invents receipts, rewrites SQL, or serializes concurrent writers.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Lexical validation only; the original SQL is always sent to PostgreSQL intact.
// Ordinary backslash strings depend on a server setting, so require E strings
// for that spelling rather than guessing where PostgreSQL closes the literal.
export function assertSingleSqlStatement(text) {
  assert.equal(typeof text, 'string', 'Observed SQL must be text');
  assert(Buffer.byteLength(text) <= 2 * 1024 * 1024, 'Observed SQL exceeds lexical budget');
  assert(!text.includes('\0'), 'Observed SQL contains NUL');
  let i = 0, content = false, terminated = false, head = null;
  const identifier = (char) => !!char && /[a-zA-Z0-9_$]/.test(char);
  function quoted(quote, escapes = false) {
    i++;
    while (i < text.length) {
      if (text[i] === quote) {
        if (text[i + 1] === quote) { i += 2; continue; }
        i++; return;
      }
      if (text[i] === '\\' && quote === "'") {
        assert(escapes, 'Unsupported ordinary SQL backslash string; use explicit E-string semantics');
        assert(i + 1 < text.length, 'Unterminated SQL E-string escape'); i += 2;
      } else i++;
    }
    throw Error(`Unterminated SQL ${quote === "'" ? 'string' : 'identifier'}`);
  }
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    if (text.startsWith('--', i)) { i += 2; while (i < text.length && !/[\r\n]/.test(text[i])) i++; continue; }
    if (text.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < text.length && depth) {
        if (text.startsWith('/*', i)) { depth++; i += 2; }
        else if (text.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      assert.equal(depth, 0, 'Unterminated SQL block comment'); continue;
    }
    assert(!terminated, 'Observed SQL must contain one statement with at most one trailing semicolon');
    if (text[i] === ';') { assert(content, 'Empty observed SQL statement'); terminated = true; i++; continue; }
    if (!content) head = text.slice(i).match(/^[a-zA-Z_]+/)?.[0]?.toUpperCase() || null;
    content = true;
    if ((text[i] === 'E' || text[i] === 'e') && text[i + 1] === "'" && !identifier(text[i - 1])) { i++; quoted("'", true); continue; }
    assert(!((text[i] === 'U' || text[i] === 'u') && text[i + 1] === '&' && ['"', "'"].includes(text[i + 2])),
      'Unsupported SQL Unicode escape quoting');
    if (text[i] === "'" || text[i] === '"') { quoted(text[i]); continue; }
    if (text[i] === '$' && !identifier(text[i - 1])) {
      const delimiter = text.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        const end = text.indexOf(delimiter, i + delimiter.length);
        assert(end >= 0, 'Unterminated SQL dollar-quoted string'); i = end + delimiter.length; continue;
      }
      const parameter = text.slice(i).match(/^\$[1-9][0-9]*/)?.[0];
      assert(parameter, 'Unsupported SQL dollar token'); i += parameter.length; continue;
    }
    assert(text.charCodeAt(i) < 128, 'Unsupported unquoted non-ASCII SQL token');
    i++;
  }
  assert(content, 'Empty observed SQL statement');
  return { head };
}

export function createNativeCommitObserver({ onBoundary, onAttempt = async () => {}, context = () => null }) {
  assert.equal(typeof onBoundary, 'function');
  const clients = new WeakMap(), transactions = new Map(), failures = [];
  let armed = false, busy = false, nextClient = 0, sequence = 0, nextTransaction = 0;
  const unsupported = (message, text = null) => {
    const error = Error(message); error.code = 'RC1_COMMIT_OBSERVER_UNSUPPORTED';
    failures.push({ message, ...(typeof text === 'string' ? { sql: text,
      sqlSha256: crypto.createHash('sha256').update(text).digest('hex'), context: structuredClone(context()) } : {}) }); return error;
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
        // true separators before execution, preserving quoted/comment text.
        try {
          const { head } = assertSingleSqlStatement(text);
          assert(!['DO', 'CALL'].includes(head), 'Observed SQL procedures can hide intermediate commits');
        }
        catch (error) { throw unsupported(error.message, text); }
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
