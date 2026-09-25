// Actor-only sustained Law integration. No database or observer capability.
import assert from 'node:assert/strict';
import { createLawPolicy, LAW_POLICY_CONTRACT } from './rc1-law-policy.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

export const LAW_WORLD_CONTRACT = Object.freeze({ version: 1, scenarioId: 'law_pressure', policy: LAW_POLICY_CONTRACT,
  populations: [25, 100, 250, 500, 1000], windowMilliseconds: 300000, maximumDecisionsPerActorPerWindow: 32,
  schedule: 'Consecutive original five-minute windows for all entrants or an explicitly pinned active cohort. Caller runs every due original worker, including hourly callbacks, between windows. No shortened detention, heat/nerve grants or probability overrides.',
  phases: 'Minimum-nerve loud pressure until a public wait. One fresh pressure action after observing indictment, then public plea. Original detention and nerve waits precede a quiet recovery win; repeat on the same character. A publicly cleared case may enter recovery without claiming an unobserved conviction or loss.',
  inputs: 'Only own ordinary /v1/session, /v1/me, /v1/law and public /v1/rules. These are normal actor reads and may accrue; never call them as unchanged-state observers.',
  evidence: 'Await a compact pending event with the complete request identity before dispatch; retain decision/outcome events for actor replay. Full checkpoint at existing serial boundaries, or explicitly before a fault. No whole-roster checkpoint per action.',
  restart: 'Full checkpoint restores window/actor/burst cursor and exact pending request. A missing response retries that request. An unknown replay blocks fresh choices pending original receipt reconciliation.',
  scope: 'This schedules existing Law branches; qualification still requires native worker, resource, lifecycle, replay and duration evidence. Deterministic adapter tests are not matrix evidence.' });

const clone = structuredClone;
const WINDOW = LAW_WORLD_CONTRACT.windowMilliseconds, BURST = LAW_WORLD_CONTRACT.maximumDecisionsPerActorPerWindow;
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
const receiptBody = ({ replayed: _flag, ...body }) => body;

export function createLawWorldAdapter(configuration) {
  assert(Object.keys(configuration).every((key) => ['seed', 'roster', 'epoch', 'activeAccountIds'].includes(key)), 'Unapproved Law configuration');
  const { seed, roster, epoch } = configuration;
  assert(typeof seed === 'string' && seed.length > 0);
  assert(Number.isSafeInteger(epoch) && epoch >= 0);
  assert(Array.isArray(roster) && LAW_WORLD_CONTRACT.populations.includes(roster.length));
  assert.equal(new Set(roster.map((actor) => actor.accountId)).size, roster.length);
  assert.equal(new Set(roster.map((actor) => actor.characterId)).size, roster.length);
  assert(roster.every((actor) => identifier(actor.accountId) && identifier(actor.characterId)));
  const activeAccountIds = clone(configuration.activeAccountIds || roster.map((actor) => actor.accountId));
  assert(Array.isArray(activeAccountIds) && activeAccountIds.length > 0 && new Set(activeAccountIds).size === activeAccountIds.length);
  assert(activeAccountIds.every((id) => roster.some((actor) => actor.accountId === id)), 'Unknown active-cohort actor');
  configuration = { seed, epoch, roster: roster.map(({ accountId, characterId }) => ({ accountId, characterId })), activeAccountIds: clone(activeAccountIds) };
  const actors = new Map(configuration.roster.map((actor) => [actor.accountId, actor]));
  let policies = new Map(activeAccountIds.map((accountId) => [accountId, createLawPolicy({ accountId, seed })]));
  let state = { version: 1, configuration: clone(configuration), completedWindows: 0, nextWindowAt: epoch, window: null, pending: null,
    unresolved: [], exactReplays: 0, byActor: Object.fromEntries(activeAccountIds.map((accountId) => [accountId,
      { phase: 'pressure', nextEligibleAt: epoch, windows: 0, completedCycles: 0, publicCaseClearances: 0,
        boundedBursts: 0, scheduledWaits: 0, lastReceipt: null }])) };
  function validate(value, components = policies) {
    assert.equal(value.version, 1); assert.deepEqual(value.configuration, configuration);
    assert.deepEqual(Object.keys(value.byActor).sort(), [...activeAccountIds].sort());
    assert(Number.isSafeInteger(value.completedWindows) && value.completedWindows >= 0);
    assert.equal(value.nextWindowAt, epoch + value.completedWindows * WINDOW);
    assert(Number.isSafeInteger(value.exactReplays) && value.exactReplays >= 0);
    if (value.window) {
      assert.equal(value.window.logicalAt, value.nextWindowAt);
      assert(Number.isSafeInteger(value.window.index) && value.window.index >= 0 && value.window.index < activeAccountIds.length);
      assert(Number.isSafeInteger(value.window.decisions) && value.window.decisions >= 0 && value.window.decisions < BURST);
    }
    for (const [accountId, actor] of Object.entries(value.byActor)) {
      assert(['pressure', 'plea', 'recover'].includes(actor.phase));
      assert(Number.isSafeInteger(actor.nextEligibleAt) && actor.nextEligibleAt >= epoch);
      for (const key of ['windows', 'completedCycles', 'publicCaseClearances', 'boundedBursts', 'scheduledWaits'])
        assert(Number.isSafeInteger(actor[key]) && actor[key] >= 0);
      const component = components.get(accountId).checkpoint().payload;
      assert(component.characterId === null || component.characterId === actors.get(accountId).characterId,
        'Component character differs from the pinned actor');
      assert.equal(actor.windows, value.completedWindows + Number(!!value.window && activeAccountIds.indexOf(accountId) < value.window.index));
      if (component.pending) {
        assert.equal(value.pending?.accountId, accountId, 'Component/adapter pending actor mismatch');
        assert.deepEqual(value.pending.decision, component.pending, 'Component/adapter pending request mismatch');
      }
    }
    if (value.pending) {
      assert(value.window && activeAccountIds[value.window.index] === value.pending.accountId);
      assert(['SELECTED', 'DISPATCHING'].includes(value.pending.dispatchState));
      assert.deepEqual(components.get(value.pending.accountId).checkpoint().payload.pending, value.pending.decision);
    }
  }
  const currentAccount = () => state.window ? activeAccountIds[state.window.index] : null;
  function finishActor() {
    const actor = state.byActor[currentAccount()]; actor.windows++;
    state.window.index++; state.window.decisions = 0;
    if (state.window.index === activeAccountIds.length) {
      state.completedWindows++; state.nextWindowAt += WINDOW; state.window = null;
    }
  }
  const api = {
    beginWindow(logicalAt) {
      assert.equal(state.unresolved.length, 0, 'Unresolved replay blocks Law scheduling');
      assert.equal(logicalAt, state.nextWindowAt, 'Run every original five-minute window; skipped windows are not sustained pressure');
      state.window ||= { logicalAt, index: 0, decisions: 0 };
      return api.cursor();
    },
    cursor() { return { completedWindows: state.completedWindows, nextWindowAt: state.nextWindowAt,
      window: clone(state.window), accountId: currentAccount(), pending: clone(state.pending) }; },
    choose(view) {
      assert(state.window); assert.equal(state.unresolved.length, 0, 'Unresolved replay blocks Law scheduling');
      const accountId = currentAccount(), actor = state.byActor[accountId], logicalAt = state.window.logicalAt;
      if (state.pending) return clone(state.pending.decision);
      assert(logicalAt >= actor.nextEligibleAt, 'Retain the previously observed public wait');
      assert.equal(view.accountId, accountId); assert.equal(view.session?.character?.id, actors.get(accountId).characterId);
      assert.equal(view.session?.authed, true); assert.equal(typeof view.law?.indicted, 'boolean');
      assert.equal(view.me?.character?.id, actors.get(accountId).characterId, 'Replacement needs an explicit separate actor cursor');
      assert(Object.keys(view).every((key) => ['accountId', 'session', 'me', 'law', 'rules'].includes(key)), 'Unapproved actor view');
      if (actor.phase === 'plea' && !view.law.indicted) { actor.phase = 'recover'; actor.publicCaseClearances++; }
      if (actor.phase === 'recover' && view.law.indicted) actor.phase = 'plea';
      const decision = policies.get(accountId).choose(view, { logicalAt, phase: actor.phase });
      if (decision.kind === 'wait') {
        actor.nextEligibleAt = logicalAt + (decision.retryAfterSeconds === null ? WINDOW : Math.ceil(decision.retryAfterSeconds * 1000));
        finishActor();
      } else {
        state.pending = { accountId, decision: clone(decision), authorizedViewSha256: actorValueHash(view),
          observedIndictment: view.law.indicted, dispatchState: 'SELECTED' };
      }
      return decision;
    },
    settle(response) {
      assert(state.pending, 'No pending Law request');
      assert(Number.isSafeInteger(response.status) && (response.status === 200 || response.status >= 400 && response.status < 500),
        'Unexpected server response leaves the exact request pending');
      assert.equal(typeof response.replayed, 'boolean');
      const pending = state.pending, { accountId, decision } = pending, actor = state.byActor[accountId];
      const body = receiptBody(response.body), status = response.status === 200 ? 'COMPLETED' : 'DENIED';
      policies.get(accountId).settle({ idempotencyKey: decision.request.idempotencyKey, status, replayed: response.replayed, response: body });
      if (response.status === 200 && response.replayed) {
        state.unresolved.push({ accountId, decision: clone(decision), response: clone(response) });
        state.pending = null; return { blocked: true, accountId, reason: 'unresolved-replayed-response' };
      }
      actor.lastReceipt = { decision: clone(decision), status: response.status, responseSha256: actorValueHash(body) };
      if (response.status === 200) {
        if (decision.type === 'law.pressure-crime' && pending.observedIndictment) actor.phase = 'plea';
        if (decision.type === 'law.plea') actor.phase = 'recover';
        if (decision.type === 'law.recovery-crime' && body.success) { actor.completedCycles++; actor.phase = 'pressure'; }
      }
      state.pending = null; state.window.decisions++;
      if (state.window.decisions === BURST) { actor.boundedBursts++; finishActor(); }
      else if (response.status !== 200) finishActor();
      return { blocked: false, accountId, phase: actor.phase, completedCycles: actor.completedCycles };
    },
    settleExactReplay(accountId, decision, response) {
      assert(!state.pending, 'Finish the current request before a separate replay control');
      const prior = state.byActor[accountId]?.lastReceipt;
      assert(prior && response.replayed && prior.status === response.status);
      assert.deepEqual(prior.decision, decision, 'Replay request changed');
      const body = receiptBody(response.body); assert.equal(prior.responseSha256, actorValueHash(body), 'Replay result changed');
      policies.get(accountId).settle({ idempotencyKey: decision.request.idempotencyKey,
        status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: true, response: body });
      state.exactReplays++;
    },
    checkpoint() {
      validate(state); const payload = { state: clone(state), policies: Object.fromEntries([...policies].map(([id, policy]) => [id, policy.checkpoint()])) };
      return { payload, sha256: actorValueHash(payload) };
    },
    restore(checkpoint) {
      assert.equal(checkpoint.sha256, actorValueHash(checkpoint.payload), 'Law adapter checkpoint checksum mismatch');
      assert.deepEqual(Object.keys(checkpoint.payload.policies).sort(), [...activeAccountIds].sort());
      const restored = new Map(activeAccountIds.map((accountId) => [accountId,
        createLawPolicy({ accountId, seed }).restore(checkpoint.payload.policies[accountId])]));
      validate(checkpoint.payload.state, restored); state = clone(checkpoint.payload.state); policies = restored; return api;
    },
    summary() {
      const perActor = activeAccountIds.map((accountId) => ({ accountId, ...clone(state.byActor[accountId]),
        lastReceipt: undefined, policy: policies.get(accountId).summary() }));
      for (const actor of perActor) delete actor.lastReceipt;
      return { scenarioId: 'law_pressure', population: configuration.roster.length, activeCohort: clone(activeAccountIds),
        completedWindows: state.completedWindows, observedLogicalDays: Math.max(0, state.completedWindows - 1) * WINDOW / 86400000,
        lastCompletedWindowAt: state.completedWindows ? epoch + (state.completedWindows - 1) * WINDOW : null,
        nextWindowAt: state.nextWindowAt, pending: !!state.pending, unresolvedResponses: state.unresolved.length,
        exactReplays: state.exactReplays, perActor, completedCycles: perActor.reduce((sum, actor) => sum + actor.completedCycles, 0),
        matrixQualifying: false, workerCoverage: 'Caller must retain original timer coverage separately' };
    },
    async runWindow(logicalAt, { read, execute, record }, { maximumDecisions = 64, pauseBeforeDispatch = false } = {}) {
      assert.equal(typeof read, 'function'); assert.equal(typeof execute, 'function'); assert.equal(typeof record, 'function');
      assert(Number.isSafeInteger(maximumDecisions) && maximumDecisions >= 1 && maximumDecisions <= 4096);
      api.beginWindow(logicalAt);
      for (let count = 0; count < maximumDecisions && state.window; count++) {
        const accountId = currentAccount(), actor = state.byActor[accountId];
        let decision;
        if (state.pending) decision = clone(state.pending.decision);
        else if (actor.nextEligibleAt > logicalAt) {
          await record({ kind: 'law-scheduled-wait', accountId, logicalAt, retryAt: actor.nextEligibleAt,
            basis: 'Previously observed public policy wait; not a dead-world clearance' });
          actor.scheduledWaits++; finishActor(); continue;
        } else {
          const view = { accountId, session: await read(accountId, '/v1/session'), me: await read(accountId, '/v1/me'),
            law: await read(accountId, '/v1/law'), rules: await read(accountId, '/v1/rules') };
          decision = api.choose(view);
          await record({ kind: 'law-decision', accountId, logicalAt, authorizedViewSha256: actorValueHash(view), decision });
          if (decision.kind === 'wait') continue;
        }
        // Await durable recording of every exact identity before the side effect.
        await record({ kind: 'law-pending', logicalAt, window: clone(state.window), ...clone(state.pending) });
        if (pauseBeforeDispatch) return { complete: false, paused: true, cursor: api.cursor() };
        state.pending.dispatchState = 'DISPATCHING';
        const response = await execute(accountId, clone(decision.request));
        const outcome = api.settle(response);
        await record({ kind: 'law-settlement', accountId, logicalAt, request: clone(decision.request), response: clone(response), outcome });
        if (outcome.blocked) return { complete: false, blocked: true, cursor: api.cursor() };
      }
      return { complete: state.window === null, cursor: api.cursor() };
    },
  };
  return api;
}
