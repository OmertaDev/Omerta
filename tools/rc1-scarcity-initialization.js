// Prebaseline actor work only. The caller owns HTTP, original workers and exact
// native balances/custody; no database, timer replacement or grant capability.
import assert from 'node:assert/strict';
import { M3, MEGAPROJECT } from '../src/rules.js';
import { actorValueHash as hash } from './rc1-native-actor-replay.js';

const clone = structuredClone, POLL_MS = 300000;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
export const SCARCITY_INITIALIZATION_CONTRACT = Object.freeze({ version: 1,
  populations: [25, 100, 250, 500, 1000],
  source: ['src/social/combat.js:jump', 'src/accrual.js:accrue', 'src/megaproject.js:giveCash', 'src/game.js:checkin', 'src/invariants.js'],
  preparation: 'Verify ordinary generation1 entry. Five fresh admitted standard jumps consume each actor\'s birth25 rounds; wins and losses both count. Targets must be enrolled ordinary characters currently visible on the public same-location streets board. Then donate remaining whole cash through the public megaproject, using a canonical check-in only if a positive remainder is below its public minimum.',
  recovery: 'Finish each roster pass before advancing the earliest observed wait. Public jail/hospital/protection waits retain their deadlines; an unavailable target or regenerative gate is observed again after at most five logical minutes. The caller executes every due original worker. No wall-clock game-timer sleeps or authored expiry writes.',
  authority: 'Own authenticated session/me, public rules and streets only. Generation changes, unexpected personal ammo/bank, unavailable legal recovery or exhausted declared initialization duration remain actual failures. No fixture deaths, balance edits, fabricated receipts or permissions.',
  baseline: 'Successful helper verification is public-view cash0/bank0/ammo0 at one fixed logical time. These public cash/bank fields are rounded; caller must separately assert exact native zero balances, retain all escrow/custody, and pass original invariants before the measured snapshot. No all-resource or global/NPC minimum is claimed.',
  replay: 'Await exact pending request evidence before HTTP dispatch; checkpoint retains cursor/receipt identities and any pending original-worker advance. Unknown successful replay blocks fresh work until caller reconciles the original receipt. Intermediate events are incremental evidence, not full checkpoints.' });

export function createScarcityInitialization(input) {
  assert.deepEqual(Object.keys(input).sort(), ['epoch', 'maximumLogicalMs', 'roster', 'seed']);
  const { seed, epoch, maximumLogicalMs } = input;
  assert(typeof seed === 'string' && seed.length);
  assert(Number.isSafeInteger(epoch) && epoch >= 0);
  assert(Number.isSafeInteger(maximumLogicalMs) && maximumLogicalMs > 0 && Number.isSafeInteger(epoch + maximumLogicalMs));
  assert(SCARCITY_INITIALIZATION_CONTRACT.populations.includes(input.roster.length));
  const roster = input.roster.map(({ accountId, characterId }) => ({ accountId, characterId }));
  for (const key of ['accountId', 'characterId']) {
    assert(roster.every(actor => validId(actor[key])));
    assert.equal(new Set(roster.map(actor => actor[key])).size, roster.length);
  }
  assert.equal(M3.JUMP_AMMO, 5, 'Review changed canonical jump consumption');
  assert.equal(M3.JUMP_ENERGY, 25); assert.equal(M3.JUMP_MIN_HEALTH, 20);
  const configuration = { seed, epoch, maximumLogicalMs, roster }, configurationSha256 = hash(configuration);
  const characterIds = new Set(roster.map(actor => actor.characterId));
  let state = { version: 1, configuration, logicalAt: epoch, phase: 'entry', cursor: 0,
    passProgress: false, earliestWaitAt: null, pendingWait: null, pending: null, failure: null,
    sequence: 0, receipts: [], waits: 0, workerAdvances: 0, denied: 0,
    actors: roster.map(() => ({ entryVerified: false, admissions: 0, jumpAttempts: 0, cashZeroObserved: false, verifiedAt: null })) };

  function validateRequest(request, index, kind) {
    assert.equal(request.method, 'POST');
    if (kind === 'jump') {
      const match = /^\/v1\/streets\/([a-zA-Z0-9_-]+)\/jump$/.exec(request.path);
      assert(match && characterIds.has(match[1]) && match[1] !== roster[index].characterId);
      assert.deepEqual(request.body, { intent: 'standard' });
    } else if (kind === 'checkin') {
      assert.equal(request.path, '/v1/checkin'); assert.deepEqual(request.body, {});
    } else {
      assert.equal(kind, 'donate'); assert.equal(request.path, '/v1/megaproject/cash');
      assert.deepEqual(Object.keys(request.body), ['amount']);
      assert(Number.isSafeInteger(request.body.amount) && request.body.amount >= MEGAPROJECT.MIN_CASH);
    }
  }
  function validate() {
    assert.equal(state.version, 1); assert.deepEqual(state.configuration, configuration);
    assert(['entry', 'ammo', 'cash', 'verify', 'complete'].includes(state.phase));
    assert(Number.isSafeInteger(state.logicalAt) && state.logicalAt >= epoch && state.logicalAt <= epoch + maximumLogicalMs);
    assert(Number.isSafeInteger(state.cursor) && state.cursor >= 0 && state.cursor < roster.length);
    assert.equal(typeof state.passProgress, 'boolean');
    assert(state.earliestWaitAt === null || Number.isSafeInteger(state.earliestWaitAt) && state.earliestWaitAt > state.logicalAt);
    assert.equal(state.actors.length, roster.length);
    const admitted = roster.map(() => 0);
    for (const [index, row] of state.receipts.entries()) {
      assert(Number.isSafeInteger(row.index) && row.index >= 0 && row.index < roster.length);
      assert(['FRESH', 'DENIED'].includes(row.status)); assert(/^[a-f0-9]{64}$/.test(row.responseSha256));
      assert(Number.isSafeInteger(row.logicalAt) && row.logicalAt >= epoch && row.logicalAt <= state.logicalAt);
      assert.equal(row.request.idempotencyKey, requestKey(index + 1, row.index, row.kind));
      validateRequest(row.request, row.index, row.kind);
      if (row.kind === 'jump' && row.status === 'FRESH') admitted[row.index]++;
    }
    for (const [index, actor] of state.actors.entries()) {
      assert.equal(typeof actor.entryVerified, 'boolean'); assert.equal(typeof actor.cashZeroObserved, 'boolean');
      assert(Number.isSafeInteger(actor.admissions) && actor.admissions >= 0 && actor.admissions <= 5);
      assert(Number.isSafeInteger(actor.jumpAttempts) && actor.jumpAttempts >= actor.admissions);
      assert.equal(admitted[index], actor.admissions, 'Ammo admission count differs from retained receipts');
      assert(actor.verifiedAt === null || Number.isSafeInteger(actor.verifiedAt) && actor.verifiedAt >= epoch && actor.verifiedAt <= state.logicalAt);
    }
    for (const key of ['sequence', 'waits', 'workerAdvances', 'denied']) assert(Number.isSafeInteger(state[key]) && state[key] >= 0);
    assert.equal(state.sequence, state.receipts.length + Number(!!state.pending));
    assert.equal(new Set(state.receipts.map(row => row.request.idempotencyKey)).size, state.receipts.length);
    assert.equal(state.denied, state.receipts.filter(row => row.status === 'DENIED').length);
    if (state.pending) {
      assert.equal(state.pending.index, state.cursor); assert.equal(state.pending.logicalAt, state.logicalAt);
      assert.equal(state.pending.accountId, roster[state.cursor].accountId);
      assert.equal(state.pending.request.idempotencyKey, requestKey(state.sequence, state.pending.index, state.pending.kind));
      assert.equal(state.pending.phase, state.phase);
      assert(['jump', 'checkin', 'donate'].includes(state.pending.kind));
      assert.equal(state.phase, state.pending.kind === 'jump' ? 'ammo' : 'cash');
      assert.equal(state.pending.observedAmmo, 25 - 5 * state.actors[state.cursor].admissions);
      if (state.pending.kind === 'donate') assert.equal(state.pending.request.body.amount, state.pending.observedCash);
      validateRequest(state.pending.request, state.pending.index, state.pending.kind);
      assert.equal(hash(state.pending.request), state.pending.requestSha256);
    }
    if (state.pendingWait) {
      assert(!state.pending); assert.equal(state.pendingWait.from, state.logicalAt);
      assert(state.pendingWait.to > state.logicalAt && state.pendingWait.to <= epoch + maximumLogicalMs);
      assert.equal(state.cursor, 0);
    }
    if (state.phase !== 'entry') assert(state.actors.every(actor => actor.entryVerified));
    if (['cash', 'verify', 'complete'].includes(state.phase)) assert(state.actors.every(actor => actor.admissions === 5));
    if (state.phase === 'complete') assert(state.actors.every(actor => actor.verifiedAt === state.logicalAt));
  }
  const requestKey = (sequence, index, kind) => 'rc1-scarcity-setup-' + hash([configurationSha256, sequence, index, kind]);
  function wait(reason, seconds = null) {
    const to = state.logicalAt + (seconds === null ? POLL_MS : Math.max(1, Math.ceil(seconds * 1000)));
    state.earliestWaitAt = Math.min(state.earliestWaitAt ?? to, to); state.waits++;
    return { reason, observedAt: state.logicalAt, retryAt: to };
  }
  function next() { state.cursor++; if (state.cursor === roster.length) state.cursor = 0; }
  async function fail(record, reason, details = {}) {
    state.failure = { status: 'UNKNOWN', reason, logicalAt: state.logicalAt, phase: state.phase, cursor: state.cursor, ...clone(details) };
    await record({ kind: 'scarcity-initialization-failure', configurationSha256, ...clone(state.failure) });
  }
  function summary() {
    validate(); return { complete: state.phase === 'complete' && !state.failure, phase: state.phase, logicalAt: state.logicalAt,
      population: roster.length, entryVerified: state.actors.filter(actor => actor.entryVerified).length,
      admittedJumps: state.actors.reduce((sum, actor) => sum + actor.admissions, 0),
      verifiedActors: state.actors.filter(actor => actor.verifiedAt === state.logicalAt).length,
      waits: state.waits, workerAdvances: state.workerAdvances, denied: state.denied,
      pending: !!state.pending, pendingOriginalAdvance: clone(state.pendingWait), failure: clone(state.failure),
      nativeBaselineRequired: true, matrixQualifying: false };
  }
  async function observe(index, read) {
    const actor = roster[index], session = await read(actor.accountId, '/v1/session'), me = await read(actor.accountId, '/v1/me');
    assert.equal(session.authed, true); assert.equal(session.character?.id, actor.characterId);
    const own = me.character; assert.equal(own?.id, actor.characterId); assert.equal(own.generation, 1, 'Ordinary enrolled generation changed');
    for (const field of ['cash', 'bank', 'ammo', 'energy', 'health']) assert(Number.isSafeInteger(own[field]) && own[field] >= 0, 'Invalid own ' + field);
    assert.equal(own.bank, 0, 'Unexpected bank custody during scarcity preparation');
    assert.equal(own.ammo, 25 - 5 * state.actors[index].admissions, 'Ammo differs from exact admitted jump depletion');
    for (const seconds of [own.jailSeconds, own.hospSeconds, own.safeSeconds, own.law?.witproSeconds])
      assert(Number.isFinite(seconds) && seconds >= 0, 'Missing public recovery deadline');
    return { own, session, me };
  }
  async function completePass(record) {
    if (state.phase === 'entry') { state.phase = 'ammo'; state.passProgress = false; state.earliestWaitAt = null; return; }
    if (state.phase === 'ammo' && state.actors.every(actor => actor.admissions === 5)) {
      state.phase = 'cash'; state.passProgress = false; state.earliestWaitAt = null; return;
    }
    if (state.phase === 'cash' && state.actors.every(actor => actor.cashZeroObserved)) {
      state.phase = 'verify'; state.passProgress = false; state.earliestWaitAt = null; return;
    }
    if (state.phase === 'verify') { state.phase = 'complete'; return; }
    if (!state.passProgress) {
      const to = state.earliestWaitAt ?? state.logicalAt + POLL_MS;
      if (to > epoch + maximumLogicalMs) { await fail(record, 'declared-initialization-duration-exhausted', { proposedLogicalAt: to }); return; }
      state.pendingWait = { from: state.logicalAt, to, phase: state.phase };
    }
    state.passProgress = false; state.earliestWaitAt = null;
  }
  const api = {
    summary,
    checkpoint() { validate(); const payload = clone(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) {
      assert.equal(hash(checkpoint.payload), checkpoint.sha256); assert.deepEqual(checkpoint.payload.configuration, configuration);
      state = clone(checkpoint.payload); validate(); return api;
    },
    async run(hooks, { maximumSteps = 128, pauseBeforeDispatch = false } = {}) {
      const { read, execute, record, advanceOriginalWorkers } = hooks;
      for (const fn of [read, execute, record, advanceOriginalWorkers]) assert.equal(typeof fn, 'function');
      assert(Number.isSafeInteger(maximumSteps) && maximumSteps > 0 && maximumSteps <= 4096);
      assert(Number.isSafeInteger(hooks.logicalAt));
      if (state.pendingWait) assert(hooks.logicalAt >= state.logicalAt && hooks.logicalAt <= state.pendingWait.to, 'Original advance clock outside retained bounds');
      else assert.equal(hooks.logicalAt, state.logicalAt, 'Caller advanced outside the retained preparation cursor');
      let suppliedAt = hooks.logicalAt;
      for (let step = 0; step < maximumSteps && !state.failure && state.phase !== 'complete'; step++) {
        if (state.pendingWait) {
          const pending = clone(state.pendingWait);
          await record({ kind: 'scarcity-original-advance-pending', configurationSha256, ...pending });
          // A restored controller already at the target must not repeat callbacks.
          const reached = suppliedAt === pending.to ? suppliedAt : await advanceOriginalWorkers(pending.to);
          assert.equal(reached, pending.to, 'Original controller did not reach requested preparation time');
          state.logicalAt = reached; suppliedAt = reached; state.pendingWait = null; state.workerAdvances++;
          for (const actor of state.actors) { actor.cashZeroObserved = false; actor.verifiedAt = null; }
          await record({ kind: 'scarcity-original-advance-complete', configurationSha256, ...pending }); continue;
        }
        const index = state.cursor, actor = roster[index], progress = state.actors[index];
        if (!state.pending) {
          let view;
          try { view = await observe(index, read); }
          catch (error) { await fail(record, 'invalid-own-observation', { message: error.message }); break; }
          const own = view.own;
          if (state.phase === 'entry') {
            if (own.cash !== 500 || own.cb !== 0 || own.omr !== 0 || own.respect !== 0 || own.level !== 1 || own.checkin?.done !== false) {
              await fail(record, 'ordinary-entry-not-established'); break;
            }
            progress.entryVerified = true;
            await record({ kind: 'scarcity-entry-verified', configurationSha256, accountId: actor.accountId, characterId: actor.characterId,
              logicalAt: state.logicalAt, viewSha256: hash(view) }); next(); if (state.cursor === 0) await completePass(record); continue;
          }
          if (state.phase === 'verify') {
            if (own.cash !== 0) {
              state.phase = 'cash'; state.cursor = 0; state.passProgress = false; state.earliestWaitAt = null;
              for (const value of state.actors) { value.cashZeroObserved = false; value.verifiedAt = null; }
              await record({ kind: 'scarcity-cash-recheck', configurationSha256, accountId: actor.accountId, logicalAt: state.logicalAt, observedCash: own.cash }); continue;
            }
            progress.verifiedAt = state.logicalAt;
            await record({ kind: 'scarcity-public-floor-verified', configurationSha256, accountId: actor.accountId, characterId: actor.characterId,
              logicalAt: state.logicalAt, cash: own.cash, bank: own.bank, ammo: own.ammo, generation: own.generation,
              admittedJumps: progress.admissions, viewSha256: hash(view), exactNativeBalanceAndCustodyReviewRequired: true });
            next(); if (state.cursor === 0) await completePass(record); continue;
          }
          let kind, path, body, waiting = null;
          if (state.phase === 'ammo') {
            if (progress.admissions === 5) { next(); if (state.cursor === 0) await completePass(record); continue; }
            const seconds = Math.max(own.jailSeconds, own.hospSeconds, own.safeSeconds, own.law.witproSeconds);
            if (seconds > 0) waiting = wait('public-offense-recovery', seconds);
            else if (own.energy < M3.JUMP_ENERGY || own.health < M3.JUMP_MIN_HEALTH) waiting = wait('original-energy-health-regeneration');
            else {
              const board = await read(actor.accountId, '/v1/streets'); assert(Array.isArray(board.streets));
              const targets = board.streets.filter(target => characterIds.has(target.id) && target.id !== own.id && target.npc === false
                && target.loc === own.loc && target.jailed === false && target.hospitalized === false
                && !(own.gang?.tag && own.gang.tag === target.gangTag));
              assert.equal(new Set(targets.map(target => target.id)).size, targets.length, 'Duplicate public target');
              const ranks = new Map(targets.map(target => [target.id, hash([seed, actor.accountId, progress.jumpAttempts, target.id])]));
              targets.sort((a, b) => ranks.get(a.id).localeCompare(ranks.get(b.id)));
              if (!targets.length) waiting = wait('no-publicly-available-enrolled-target');
              else { kind = 'jump'; path = '/v1/streets/' + targets[0].id + '/jump'; body = { intent: 'standard' }; }
            }
          } else {
            assert.equal(state.phase, 'cash');
            if (own.cash === 0) { progress.cashZeroObserved = true; next(); if (state.cursor === 0) await completePass(record); continue; }
            progress.cashZeroObserved = false;
            if (own.jailSeconds > 0) waiting = wait('public-donation-detention', own.jailSeconds);
            else {
              const rules = await read(actor.accountId, '/v1/rules'), minimum = rules.megaproject?.minCash;
              assert.equal(minimum, MEGAPROJECT.MIN_CASH, 'Review changed public cash sink minimum');
              if (own.cash >= minimum) { kind = 'donate'; path = '/v1/megaproject/cash'; body = { amount: own.cash }; }
              else if (own.checkin?.done === false && Number.isSafeInteger(own.checkin.pay) && own.checkin.pay > 0) {
                kind = 'checkin'; path = '/v1/checkin'; body = {};
              } else waiting = wait('positive-cash-remainder-awaits-canonical-checkin');
            }
          }
          if (waiting) {
            await record({ kind: 'scarcity-public-wait', configurationSha256, accountId: actor.accountId, phase: state.phase, ...waiting });
            next(); if (state.cursor === 0) await completePass(record); continue;
          }
          state.sequence++;
          const request = { method: 'POST', path, body, idempotencyKey: requestKey(state.sequence, index, kind) };
          state.pending = { phase: state.phase, index, accountId: actor.accountId, logicalAt: state.logicalAt, kind, request,
            requestSha256: hash(request), ownViewSha256: hash(view), observedAmmo: own.ammo, observedCash: own.cash,
            expectedCheckinPay: kind === 'checkin' ? own.checkin.pay : null };
        }
        await record({ ...clone(state.pending), actionKind: state.pending.kind, kind: 'scarcity-request-pending', configurationSha256 });
        if (pauseBeforeDispatch) return { complete: false, paused: true, logicalAt: state.logicalAt, summary: summary() };
        const pending = clone(state.pending), response = await execute(actor.accountId, clone(pending.request));
        if (typeof response.replayed !== 'boolean' || !Number.isSafeInteger(response.status)
          || !(response.status === 200 || response.status >= 400 && response.status < 500)) {
          await fail(record, 'unexpected-http-outcome', { request: pending.request, response: clone(response) }); break;
        }
        if (response.status === 200 && response.replayed) {
          await fail(record, 'unresolved-successful-replay', { request: pending.request, responseSha256: hash(response) }); break;
        }
        const status = response.status === 200 ? 'FRESH' : 'DENIED';
        if (status === 'FRESH') {
          const value = response.body;
          try {
            if (pending.kind === 'jump') { assert.equal(value.ok, true); assert.equal(typeof value.win, 'boolean');
              assert.equal(value.intent, 'standard'); assert.equal(value.energy, M3.JUMP_ENERGY); }
            if (pending.kind === 'checkin') { assert.equal(value.ok, true); assert.equal(value.pay, pending.expectedCheckinPay); }
            if (pending.kind === 'donate') { assert(Number.isSafeInteger(value.credited) && value.credited > 0 && value.credited <= pending.request.body.amount); }
          } catch (error) { await fail(record, 'unexpected-canonical-receipt', { request: pending.request, responseSha256: hash(response), message: error.message }); break; }
          if (pending.kind === 'jump') progress.admissions++;
          state.passProgress = true;
        } else { state.denied++; wait('canonical-admission-denial'); }
        if (pending.kind === 'jump') progress.jumpAttempts++;
        const receipt = { index, kind: pending.kind, logicalAt: state.logicalAt, request: pending.request, status, responseSha256: hash(response) };
        state.receipts.push(receipt); state.pending = null;
        await record({ ...clone(receipt), actionKind: receipt.kind, kind: 'scarcity-request-settled', configurationSha256, response: clone(response) });
        next(); if (state.cursor === 0) await completePass(record);
      }
      return { complete: state.phase === 'complete' && !state.failure, blocked: !!state.failure, logicalAt: state.logicalAt, summary: summary() };
    },
  };
  return api;
}
