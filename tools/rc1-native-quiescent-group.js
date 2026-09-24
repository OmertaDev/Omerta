// Test-only observer routing. Original SQL and canonical HTTP handlers execute
// concurrently; only the resource evidence boundary changes while a group runs.
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { assertSingleSqlStatement } from './rc1-native-commit-observer.js';
import { actorValueHash } from './rc1-native-actor-replay.js';
import { sha256 } from './rc1-resource-journal.js';

const clone = structuredClone;
// Same snapshot hash protocol as worldResourceHash, without importing game/db.
const worldStateHash = ({ boundary, ...state }) => sha256(state);
export const QUIESCENT_GROUP_CONTRACT = Object.freeze({ version: 1,
  provenance: 'Extracted from test/rc1-market-native.js dispatch/ack trace and quiescent resource snapshots. No production SQL rewriting, ordering, locking, timer changes or telemetry omission.',
  boundary: 'Pause the existing serial observer at quiescence; capture before; await every canonical request and queued-work drain; require no native query or transaction outstanding; capture after; reconcile/record one explicit QUIESCENT_AGGREGATE boundary; then resume serial observation.',
  ordering: 'SQL dispatch and acknowledgment order with per-request/client/local-transaction identity are observations, not PostgreSQL total commit order. One request with internally overlapping SQL is not concurrent-player evidence.',
  sourceWitnesses: 'The serial source-bound witness collectors are bypassed inside the aggregate. Workers normally keep their serial route; an explicit original market-sweep companion retains full SQL/parameters/results and separate worker identity/outcome. Its aggregate lineage requires separate trace-bound classification, never a fabricated serial COMMITTED witness. Other operations needing serial witnesses remain serial.',
  integration: 'Pass this router as commitObserver to installWorkerInstrumentation before pool construction. snapshot must use the separate uninstrumented diagnostic connection. onGroup must reconcile exact before/after/receipts, retain the trace, and advance priorResources before returning. drain must await all queued world telemetry.',
  failure: 'All started requests settle before capture. Capture/reconciliation/unfinished-SQL failures quarantine the router; no following serial query can absorb an unrecorded aggregate. An HTTP execution throw can resume serial observation only after successful group reconciliation, then is rethrown with its retained outcomes.',
  companion: 'Optional companion={identity:{kind:"original-worker-job",label:"market sweep",logicalAt,sourceFile:"src/worker.js",sourceSha256,handlerSourceFile:"src/market.js",handlerSourceSha256},execute:originalFn}. Caller must pass the actual source-pinned due job callback at its unchanged time. No timer is advanced or worker implementation substituted. HTTP response return shape is unchanged; originalFn result is retained in companionOutcomes and can be captured by the caller wrapper.',
});

export function createNativeQuiescentGroupObserver({ serialObserver, snapshot, onGroup, clock, record = async () => {} }) {
  for (const method of ['wrapQuery', 'arm', 'disarm', 'diagnostic', 'assertComplete']) assert.equal(typeof serialObserver?.[method], 'function');
  for (const callback of [snapshot, onGroup, clock, record]) assert.equal(typeof callback, 'function');
  const contexts = new AsyncLocalStorage(), clients = new WeakMap();
  let nextClient = 0, nextGroup = 0, active = null, failure = null, chain = actorValueHash(QUIESCENT_GROUP_CONTRACT);
  const totals = { groups: 0, requests: 0, sqlQueries: 0, requestOverlapGroups: 0, sqlOverlapGroups: 0, commitAcknowledgments: 0, rollbackAcknowledgments: 0 };
  const ensureUsable = () => assert(!failure, 'Quiescent aggregate observer is quarantined after an evidence failure');
  const errorValue = error => ({ name: error?.name || 'Error', code: error?.code || null, message: error?.message || String(error) });
  function event(group, value) { group.trace.push({ sequence: ++group.sequence, logicalAt: clock(), ...value }); }
  function requireFixedTime(group) { assert.equal(clock(), group.logicalAt, 'Logical clock changed during a quiescent group'); }
  const api = {
    arm() { ensureUsable(); assert(!active, 'Cannot arm serial observation inside a group'); serialObserver.arm(); },
    disarm() { assert(!active, 'Cannot disarm an active aggregate'); serialObserver.disarm(); },
    assertComplete() { ensureUsable(); assert(!active, 'Unfinished quiescent group'); serialObserver.assertComplete(); },
    diagnostic() { return { ...serialObserver.diagnostic(), quiescentGroups: { version: 1, active: active ? {
      id: active.id, phase: active.phase, inFlightRequests: active.inFlightRequests, inFlightCompanions: active.inFlightCompanions, inFlightQueries: active.inFlightQueries,
      openTransactions: [...active.transactions.values()] } : null, totals: clone(totals), chain, failure: clone(failure) } }; },
    wrapQuery(client, query) {
      const serialQuery = serialObserver.wrapQuery(client, query);
      if (!clients.has(client)) clients.set(client, ++nextClient);
      const clientId = clients.get(client);
      return async (sql, parameters) => {
        ensureUsable(); const group = active;
        if (!group) return serialQuery(sql, parameters);
        const context = contexts.getStore();
        assert(context?.groupId === group.id, 'Unattributed query crossed the aggregate; use an uninstrumented diagnostic connection');
        requireFixedTime(group);
        const text = typeof sql === 'string' ? sql : sql.text, structural = assertSingleSqlStatement(text);
        assert(!['DO', 'CALL', 'PREPARE', 'EXECUTE', 'DEALLOCATE'].includes(structural.head), 'Aggregate cannot attribute hidden transaction boundaries');
        if (['COMMIT', 'END', 'ROLLBACK', 'ABORT'].includes(structural.head))
          assert(!structural.tokens.includes('CHAIN') && !structural.tokens.includes('PREPARED'), 'Unsupported chained/prepared aggregate transaction');
        const rollbackTo = structural.head === 'ROLLBACK'
          && structural.tokens[['WORK', 'TRANSACTION'].includes(structural.tokens[1]) ? 2 : 1] === 'TO';
        const queryId = ++group.queries, transaction = group.transactions.get(clientId);
        const entry = { queryId, clientId, requestIndex: context.requestIndex, authority: context.authority,
          transactionId: transaction?.id || null, sqlSha256: crypto.createHash('sha256').update(text).digest('hex'), sqlHead: structural.head };
        if (context.companionIndex !== undefined) entry.companionIndex = context.companionIndex;
        const original = context.authority === 'original-worker-job' ? { sql: clone(sql), parametersProvided: parameters !== undefined,
          parameters: parameters === undefined ? null : clone(parameters) } : null;
        group.inFlightQueries++; group.maximumQueries = Math.max(group.maximumQueries, group.inFlightQueries);
        event(group, { phase: 'DISPATCH', ...entry, ...(original ? { original } : {}) });
        let nativeReturned = false;
        try {
          // Same SQL/config object and same parameter array; no serialization.
          const result = await query(sql, parameters); nativeReturned = true; requireFixedTime(group);
          assert(!Array.isArray(result), 'Aggregate requires one native statement result');
          const tag = result.command;
          if (tag === 'BEGIN' || tag === 'START') {
            assert(!group.transactions.has(clientId), 'Nested transaction in aggregate');
            const opened = { id: ++group.nextTransaction, clientId, requestIndex: context.requestIndex, firstQuery: queryId };
            group.transactions.set(clientId, opened); entry.transactionId = opened.id;
            group.maximumTransactions = Math.max(group.maximumTransactions, group.transactions.size);
          } else if (!rollbackTo && ['COMMIT', 'ROLLBACK'].includes(tag)) {
            assert(group.transactions.has(clientId), 'Aggregate transaction ended without observed BEGIN');
            entry.transactionId = group.transactions.get(clientId).id; group.transactions.delete(clientId);
            if (tag === 'COMMIT') group.commits++; else group.rollbacks++;
          }
          const nativeResult = original ? { command: result.command ?? null, rowCount: result.rowCount ?? null,
            rows: clone(result.rows || []), fields: clone(result.fields || []) } : null;
          event(group, { phase: 'ACKNOWLEDGED', ...entry, command: tag || null, rowCount: result.rowCount ?? null,
            ...(nativeResult ? { nativeResult, nativeResultSha256: actorValueHash(nativeResult) } : {}) });
          return result;
        } catch (error) {
          if (nativeReturned) group.observationErrors.push(errorValue(error));
          event(group, { phase: nativeReturned ? 'OBSERVATION_FAILED' : 'THREW', ...entry, error: errorValue(error) }); throw error;
        } finally { group.inFlightQueries--; }
      };
    },
    async runGroup(requests, { logicalAt, execute, drain, identity = {}, companion = null }) {
      ensureUsable(); assert(!active, 'Nested/overlapping aggregate groups are unsupported');
      assert(Array.isArray(requests) && requests.length > 0, 'At least one canonical request is required');
      assert.equal(typeof execute, 'function'); assert.equal(typeof drain, 'function', 'Explicit queued-work drain is required');
      assert(Number.isSafeInteger(logicalAt) && clock() === logicalAt);
      for (const item of requests) {
        assert(typeof item.accountId === 'string' && typeof item.request?.method === 'string');
        assert(typeof item.request.path === 'string' && item.request.path.startsWith('/v1/'));
      }
      const companions = [];
      if (companion) {
        assert.equal(typeof companion.execute, 'function');
        const worker = companion.identity;
        assert.equal(worker?.kind, 'original-worker-job'); assert.equal(worker.label, 'market sweep'); assert.equal(worker.logicalAt, logicalAt);
        assert.equal(worker.sourceFile, 'src/worker.js'); assert.match(worker.sourceSha256, /^[a-f0-9]{64}$/);
        assert.equal(worker.handlerSourceFile, 'src/market.js'); assert.match(worker.handlerSourceSha256, /^[a-f0-9]{64}$/);
        companions.push({ ...clone(worker), companionIndex: 0 });
      }
      serialObserver.assertComplete(); assert.equal(serialObserver.diagnostic().armed, true, 'Start from armed serial observation');
      serialObserver.disarm();
      const group = { id: ++nextGroup, logicalAt, phase: 'before', trace: [], sequence: 0, queries: 0, transactions: new Map(),
        observationErrors: [], nextTransaction: 0, inFlightRequests: 0, inFlightCompanions: 0, workerRequestOverlap: false,
        inFlightQueries: 0, maximumRequests: 0, maximumQueries: 0, maximumTransactions: 0, commits: 0, rollbacks: 0 };
      active = group;
      const groupIdentity = { kind: 'resource-quiescent-aggregate', outcome: 'QUIESCENT_AGGREGATE', groupId: group.id,
        scope: 'All committed resource changes between quiescent before/after snapshots',
        context: { authority: 'ordinary-http-quiescent-group', logicalAt, requests: requests.map((item, requestIndex) => ({
          requestIndex, accountId: item.accountId, method: item.request.method, path: item.request.path,
          idempotencyKey: item.request.idempotencyKey || null })) },
        requestCount: requests.length, requestsSha256: actorValueHash(requests), caller: clone(identity) };
      if (companion) {
        groupIdentity.context.companions = clone(companions); groupIdentity.companionCount = 1;
        groupIdentity.companionsSha256 = actorValueHash(companions);
      }
      let before = null, after = null, outcomes = null, companionOutcomes = [], evidence = null;
      try {
        before = await snapshot(); requireFixedTime(group); group.phase = 'requests';
        const requestExecutions = requests.map((item, requestIndex) => contexts.run({ groupId: group.id, requestIndex, authority: 'ordinary-http' }, async () => {
          group.inFlightRequests++; group.maximumRequests = Math.max(group.maximumRequests, group.inFlightRequests);
          event(group, { phase: 'REQUEST_DISPATCH', requestIndex });
          try {
            const result = await execute(item.accountId, clone(item.request));
            event(group, { phase: 'REQUEST_RETURNED', requestIndex, status: result?.status ?? null }); return result;
          } catch (error) { event(group, { phase: 'REQUEST_THREW', requestIndex, error: errorValue(error) }); throw error; }
          finally { group.inFlightRequests--; }
        }));
        const companionExecutions = companion ? [contexts.run({ groupId: group.id, requestIndex: null, companionIndex: 0, authority: 'original-worker-job' }, async () => {
          group.inFlightCompanions++; group.workerRequestOverlap ||= group.inFlightRequests > 0;
          event(group, { phase: 'COMPANION_DISPATCH', companionIndex: 0, authority: 'original-worker-job' });
          try {
            const result = await companion.execute();
            event(group, { phase: 'COMPANION_RETURNED', companionIndex: 0, authority: 'original-worker-job' }); return result;
          } catch (error) { event(group, { phase: 'COMPANION_THREW', companionIndex: 0, authority: 'original-worker-job', error: errorValue(error) }); throw error; }
          finally { group.inFlightCompanions--; }
        })] : [];
        const completed = await Promise.allSettled([...requestExecutions, ...companionExecutions]);
        outcomes = completed.slice(0, requests.length); companionOutcomes = completed.slice(requests.length);
        group.phase = 'drain';
        await contexts.run({ groupId: group.id, requestIndex: null, authority: 'queued-work-drain' }, drain);
        requireFixedTime(group); assert.equal(group.inFlightRequests, 0); assert.equal(group.inFlightCompanions, 0);
        assert.equal(group.inFlightQueries, 0, 'Native query still outstanding after queued-work drain');
        assert.equal(group.transactions.size, 0, 'Native transaction still open after all requests');
        assert.equal(group.observationErrors.length, 0, 'Aggregate native observation failed after SQL returned');
        group.phase = 'after'; after = await snapshot(); requireFixedTime(group);
        const summary = { kind: groupIdentity.kind, outcome: groupIdentity.outcome, scope: groupIdentity.scope,
          requestCount: requests.length, maximumRequestsInFlight: group.maximumRequests, nativeQueries: group.queries,
          maximumSqlInFlight: group.maximumQueries, maximumOpenTransactions: group.maximumTransactions,
          commitAcknowledgments: group.commits, rollbackAcknowledgments: group.rollbacks,
          concurrentPlayerRequests: requests.length > 1 && group.maximumRequests > 1, internalSqlOverlap: group.maximumQueries > 1,
          ...(companion ? { companionCount: 1, workerRequestOverlap: group.workerRequestOverlap } : {}),
          nativeCommitOrder: false, isolatedPerCommitResources: false };
        const recordedOutcomes = outcomes.map(outcome => outcome.status === 'fulfilled' ? { status: 'fulfilled', value: clone(outcome.value) }
          : { status: 'rejected', error: errorValue(outcome.reason) });
        const recordedCompanionOutcomes = companionOutcomes.map(outcome => outcome.status === 'fulfilled' ? { status: 'fulfilled', value: clone(outcome.value) }
          : { status: 'rejected', error: errorValue(outcome.reason) });
        const traceRoot = { format: companion ? 2 : 1, kind: 'quiescent-resource-trace-root', groupId: group.id,
          beforeHash: worldStateHash(before), afterHash: worldStateHash(after), requestsSha256: groupIdentity.requestsSha256,
          outcomesSha256: actorValueHash(recordedOutcomes), traceSha256: actorValueHash(group.trace),
          ...(companion ? { companionsSha256: groupIdentity.companionsSha256, companionOutcomesSha256: actorValueHash(recordedCompanionOutcomes) } : {}) };
        groupIdentity.traceRoot = { ...traceRoot, sha256: actorValueHash(traceRoot) };
        evidence = { version: 1, identity: groupIdentity, requests: clone(requests), before, after,
          outcomes: recordedOutcomes, summary, trace: clone(group.trace), traceSha256: traceRoot.traceSha256,
          ...(companion ? { companions: clone(companions), companionOutcomes: recordedCompanionOutcomes } : {}),
          sourceWitnessScope: QUIESCENT_GROUP_CONTRACT.sourceWitnesses };
        group.phase = 'reconcile';
        await onGroup(evidence);
        await record({ kind: 'quiescent-group-complete', identity: groupIdentity, summary, traceSha256: evidence.traceSha256 });
        chain = actorValueHash([chain, groupIdentity, evidence.traceSha256, evidence.outcomes]);
        totals.groups++; totals.requests += requests.length; totals.sqlQueries += group.queries;
        totals.requestOverlapGroups += Number(summary.concurrentPlayerRequests); totals.sqlOverlapGroups += Number(summary.internalSqlOverlap);
        totals.commitAcknowledgments += group.commits; totals.rollbackAcknowledgments += group.rollbacks;
        active = null; serialObserver.arm();
      } catch (error) {
        failure = { groupId: group.id, phase: group.phase, error: errorValue(error), evidence: evidence || {
          identity: groupIdentity, requests: clone(requests), before, after, trace: clone(group.trace),
          outcomes: outcomes?.map(outcome => outcome.status === 'fulfilled' ? { status: 'fulfilled', value: clone(outcome.value) }
            : { status: 'rejected', error: errorValue(outcome.reason) }) || null,
          ...(companion ? { companions: clone(companions), companionOutcomes: companionOutcomes.map(outcome => outcome.status === 'fulfilled'
            ? { status: 'fulfilled', value: clone(outcome.value) } : { status: 'rejected', error: errorValue(outcome.reason) }) } : {}),
          inFlightQueries: group.inFlightQueries, openTransactions: [...group.transactions.values()] } };
        active = null;
        // Keep serial observation disarmed: its old priorResources cannot absorb
        // a failed aggregate. The diagnostic pool remains usable for evidence.
        throw error;
      }
      const thrown = [...outcomes, ...companionOutcomes].filter(outcome => outcome.status === 'rejected');
      if (thrown.length) {
        const error = new AggregateError(thrown.map(outcome => outcome.reason), 'Canonical group activity failed after quiescent resource reconciliation');
        error.rc1GroupId = group.id; error.rc1GroupReconciled = true; throw error;
      }
      return outcomes.map(outcome => outcome.value);
    },
  };
  return api;
}
