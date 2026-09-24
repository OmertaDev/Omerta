// Actor-only scheduling around the existing public market policy. No SQL,
// diagnostic inventory, fixtures, timer replacement, or hidden listing lookup.
import assert from 'node:assert/strict';
import { createMarketPolicy, MARKET_POLICY_CONTRACT } from './rc1-market-policy.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

const clone = structuredClone, DAY = 86400000;
const populations = [25, 50, 100, 500, 1000];
export const MARKET_WORLD_CONTRACT = Object.freeze({ version: 1, scenarioId: 'market_stress', policy: MARKET_POLICY_CONTRACT,
  entry: 'Ordinary guest/character entry. No respect, balance, cargo, listing, expiry or membership fixture. Daily current public check-in and one-unit goods purchase fund the workload canonically.',
  cadence: 'Every declared actor participates in rotating groups of three (last group can contain four/five). Repeat the retained sale/competing-takers/order-fill/warehouse-claim/goods-cancel/cash-refund cycle daily. Leave one one-hour order each day for original-worker expiry.',
  inputs: 'Verified own session/me, public rules and market board, own retained receipts, and own authenticated notifications. Focused phases may select a subset of actual public rows/catalog entries; missing board rows never prove absence or expiry.',
  concurrency: 'executeGroup optionally dispatches competing prepared takers plus one exact duplicate inside a caller-owned quiescent aggregate boundary. Without it requests execute serially and the report says so; retained native concurrency/recovery evidence remains separate.',
  retainedProof: { source: 'd283982bfc331058a9e0da2002674458a6b8a6d4', run: 'market-policy-d283982b-native',
    runSha256: 'fea5d917269f84066ee9c7bc2965b3e741cf76033a8fbd8948b471cb32481674',
    scope: 'Three in-flight requests; exact duplicate, sole winner, sale/fill/claim/cancel/refund and original expiry with no repeated refund. Retained evidence, not a claim that this world run executed concurrently.' },
  hooks: 'runDay(day,{logicalAt,read,execute,executeGroup?,decision,checkpoint,pauseBeforeDispatch?}); runTimerWindow(day,hooks) after the original due workers. read returns canonical bodies; execute returns {status,replayed,body}. The logical clock is held fixed during each hook call.',
  restart: 'Persist exact selected requests before dispatch; replay the same identities after interruption. Unknown completed replay stays unresolved and blocks progress. Full checkpoints preserve original component serialization; intermediate checkpoint events are incremental evidence.',
  scope: 'Reports actual lifecycle work, denials, waits and expiry notices; observers independently prove resource dispositions. No additional concurrency/soak/resource threshold or matrix qualification gate.' });

export function planMarketWorld({ seed, roster, day }) {
  assert(typeof seed === 'string' && seed); assert(populations.includes(roster.length));
  assert(Number.isSafeInteger(day) && day >= 0);
  const ids = roster.map(actor => actor.accountId); assert.equal(new Set(ids).size, ids.length);
  const ranked = [...ids].sort((a, b) => actorValueHash([seed, a]).localeCompare(actorValueHash([seed, b])));
  const offset = day % ranked.length, order = [...ranked.slice(offset), ...ranked.slice(0, offset)], groups = [];
  while (order.length) groups.push(order.splice(0, order.length < 6 ? order.length : 3));
  return { day, groups, participants: ids.length };
}

export function createMarketWorldAdapter({ seed, roster }) {
  assert(populations.includes(roster.length));
  assert(roster.every(actor => typeof actor.accountId === 'string' && typeof actor.characterId === 'string'));
  assert.equal(new Set(roster.map(actor => actor.accountId)).size, roster.length);
  const configuration = { version: 1, seed, roster: roster.map(({ accountId, characterId }) => ({ accountId, characterId })) };
  const configurationSha256 = actorValueHash(configuration), actors = new Map(configuration.roster.map(actor => [actor.accountId, actor]));
  let policies = new Map(configuration.roster.map(actor => [actor.accountId, createMarketPolicy({ accountId: actor.accountId, seed })]));
  let state = { version: 1, configuration: clone(configuration), completedDays: [], daily: [], workflow: null, pending: null,
    receipts: {}, unresolved: [], expiryCandidates: [], expiryNotices: [], timerWindows: [], fresh: 0, denials: 0, waits: 0, knownReplays: 0 };
  function validate(value) {
    assert.equal(value.version, 1); assert.deepEqual(value.configuration, configuration);
    assert.deepEqual(value.completedDays, Array.from({ length: value.completedDays.length }, (_, day) => day));
    for (const field of ['fresh', 'denials', 'waits', 'knownReplays']) assert(Number.isSafeInteger(value[field]) && value[field] >= 0);
    if (value.workflow) {
      const flow = value.workflow; assert.equal(flow.day, value.completedDays.length);
      assert.deepEqual(flow.plan, planMarketWorld({ seed, roster: configuration.roster, day: flow.day }));
      assert(Number.isSafeInteger(flow.index) && flow.index >= 0 && flow.index <= flow.tasks.length);
      assert.equal(actorValueHash(flow.tasks), actorValueHash(tasksFor(flow.plan)));
    }
    if (value.pending) {
      assert(value.workflow && value.pending.taskIndex === value.workflow.index);
      assert(['SELECTED', 'DISPATCHING'].includes(value.pending.dispatchState));
      assert(value.pending.items.length > 0);
      assert(Number.isSafeInteger(value.pending.settledCount) && value.pending.settledCount >= 0 && value.pending.settledCount <= value.pending.items.length);
      if (value.pending.responses) assert.equal(value.pending.responses.length, value.pending.items.length);
      for (const item of value.pending.items) assert(actors.has(item.accountId));
    }
  }
  function tasksFor(plan) {
    return plan.groups.flatMap((group, index) => [
      ...group.map(accountId => ({ phase: 'checkin', group: index, accountId })),
      ...['supply', 'sale', 'compete', 'order', 'fill', 'claim', 'relist', 'cancel', 'refund-order', 'refund-cancel']
        .map(phase => ({ phase, group: index })),
      ...(index === plan.groups.length - 1 ? [{ phase: 'expiry-order', group: index }] : []),
    ]);
  }
  const bodyHash = body => actorValueHash(body);
  function custom(accountId, phase, request, logicalAt, view) {
    request.idempotencyKey = 'rc1-market-world-' + actorValueHash([configurationSha256, state.workflow.day, state.workflow.index, accountId, request]);
    return { accountId, component: false, viewSha256: actorValueHash(view),
      decision: { kind: 'command', type: phase, phase, characterId: view.me.character.id, logicalAt, request } };
  }
  async function view(accountId, read) {
    const projection = { accountId, session: await read(accountId, '/v1/session'), me: await read(accountId, '/v1/me'),
      rules: await read(accountId, '/v1/rules'), market: await read(accountId, '/v1/market') };
    assert.equal(projection.session?.authed, true); assert.equal(projection.session.character?.id, actors.get(accountId).characterId);
    assert.equal(projection.me?.character?.id, actors.get(accountId).characterId, 'Replacement needs separate canonical enrollment provenance');
    return projection;
  }
  async function select(task, accountId, hooks, group) {
    const projection = await view(accountId, hooks.read), own = projection.me.character;
    let selected = null, wait = null;
    if (own.alive === false) wait = 'dead-character';
    else if (task.phase === 'checkin') {
      if (own.checkin?.done === false) selected = custom(accountId, 'checkin', { method: 'POST', path: '/v1/checkin', body: {} }, hooks.logicalAt, projection);
      else wait = 'checkin-already-done-or-unavailable';
    } else if (task.phase === 'supply') {
      const load = Object.values(own.cargo || {}).reduce((sum, n) => sum + Number(n), 0);
      const good = [...projection.rules.goods].sort((a, b) => a.base - b.base || a.id.localeCompare(b.id))[0];
      if (load > 0) wait = 'already-has-owned-cargo';
      else if (!good || own.cargoCap <= load || own.cash < good.base) wait = 'no-publicly-plausible-supply';
      else selected = custom(accountId, 'goods.buy', { method: 'POST', path: '/v1/goods/buy', body: { goodId: good.id, qty: 1 } }, hooks.logicalAt, projection);
    } else {
      const focused = clone(projection), cargo = own.cargo || {};
      let phase, target = null;
      if (['sale', 'relist'].includes(task.phase)) {
        phase = 'post'; focused.rules.goods = focused.rules.goods.filter(good => Number(cargo[good.id] || 0) > 0);
      } else if (['order', 'refund-order', 'expiry-order'].includes(task.phase)) {
        phase = 'post'; focused.rules.goods = focused.rules.goods.filter(good => Number(cargo[good.id] || 0) === 0
          && (task.phase !== 'order' || good.id === group.saleGood));
      } else {
        phase = ['compete', 'fill'].includes(task.phase) ? 'take' : task.phase === 'claim' ? 'claim' : 'cancel';
        target = ({ compete: group.saleId, fill: group.orderId, claim: group.orderId, cancel: group.returnId, 'refund-cancel': group.refundId })[task.phase];
        focused.market.listings = focused.market.listings.filter(listing => listing.id === target);
      }
      if (phase === 'post' || target) {
        const choice = policies.get(accountId).choose(focused, { logicalAt: hooks.logicalAt, phase });
        if (choice.kind === 'command') selected = { accountId, component: true, viewSha256: actorValueHash(projection),
          focusedViewSha256: actorValueHash(focused), decision: choice };
        else wait = choice.classification;
      } else wait = 'required-own-receipt-not-established';
    }
    const choice = selected?.decision || { kind: 'wait', phase: task.phase, reason: wait };
    await hooks.decision({ day: state.workflow.day, taskIndex: state.workflow.index, accountId, phase: task.phase, logicalAt: hooks.logicalAt }, projection, choice);
    if (!selected) { state.waits++; state.workflow.result.waits++; }
    return selected;
  }
  function settle(item, response, task, group) {
    assert.equal(typeof response.replayed, 'boolean');
    assert([200, 400, 403, 404].includes(response.status), 'Transport/in-progress response must retain pending identity');
    const { accountId, decision } = item, key = decision.request.idempotencyKey;
    const known = state.receipts[key];
    if (known) {
      assert(response.replayed && known.status === response.status && known.bodySha256 === bodyHash(response.body), 'Conflicting world market replay');
      state.knownReplays++; return;
    }
    if (item.component) policies.get(accountId).settle({ idempotencyKey: key, status: response.status === 200 ? 'COMPLETED' : 'DENIED',
      replayed: response.replayed, response: response.body });
    const receipt = { accountId, phase: task.phase, type: decision.type, request: clone(decision.request), status: response.status,
      replayed: response.replayed, bodySha256: bodyHash(response.body), logicalAt: state.workflow.logicalAt };
    if (response.status === 200 && response.replayed) { state.unresolved.push({ ...receipt, response: clone(response.body) }); return; }
    state.receipts[key] = receipt;
    if (response.status !== 200) { state.denials++; state.workflow.result.denials++; return; }
    assert.equal(response.body?.ok, true);
    if (decision.type === 'goods.buy') { assert.equal(response.body.good, decision.request.body.goodId); assert.equal(response.body.qty, 1); }
    state.fresh++; state.workflow.result.fresh++;
    state.workflow.result.byType[decision.type] = (state.workflow.result.byType[decision.type] || 0) + 1;
    if (task.phase === 'sale') { group.saleId = response.body.id; group.saleGood = response.body.good; }
    if (task.phase === 'compete') { assert(!group.winner, 'More than one fresh taker acquired the same one-unit sale'); group.winner = accountId; }
    if (task.phase === 'order') group.orderId = response.body.id;
    if (task.phase === 'relist') group.returnId = response.body.id;
    if (task.phase === 'refund-order') group.refundId = response.body.id;
    if (task.phase === 'refund-cancel') state.workflow.result.refunded += Number(response.body.refunded || 0);
    if (task.phase === 'expiry-order') state.expiryCandidates.push({ day: state.workflow.day, accountId,
      listingId: response.body.id, characterId: decision.characterId, selectedAt: decision.logicalAt, observedAt: state.workflow.logicalAt,
      returnedExpirySeconds: response.body.expiresSeconds, good: response.body.good, resolved: false });
  }
  const api = {
    roster(day) { return planMarketWorld({ seed, roster: configuration.roster, day }).groups.flat(); },
    checkpoint() {
      validate(state);
      // The component uses JSON insertion order in its checksum. Preserve its
      // exact serialized bytes through canonical outer proof serialization.
      const payload = { state: clone(state), policyJson: Object.fromEntries([...policies].map(([id, policy]) => [id, JSON.stringify(policy.checkpoint())])) };
      return { payload, sha256: actorValueHash(payload) };
    },
    restore(checkpoint) {
      assert.equal(checkpoint.sha256, actorValueHash(checkpoint.payload), 'Market world checkpoint checksum differs'); validate(checkpoint.payload.state);
      assert.deepEqual(Object.keys(checkpoint.payload.policyJson).sort(), [...actors.keys()].sort());
      const restored = new Map([...actors.keys()].map(accountId => [accountId,
        createMarketPolicy({ accountId, seed }).restore(JSON.parse(checkpoint.payload.policyJson[accountId]))]));
      const current = checkpoint.payload.state.pending;
      const pending = current?.items.slice(current.settledCount).filter(item => item.component) || [];
      for (const [id, policy] of restored) {
        const decision = policy.checkpoint().payload.pending, item = pending.find(item => item.accountId === id);
        assert.equal(!!decision, !!item, 'Component/world pending mismatch'); if (decision) assert.deepEqual(decision, item.decision);
      }
      state = clone(checkpoint.payload.state); policies = restored; return api;
    },
    summary() {
      validate(state); return { version: 1, completedDays: [...state.completedDays], daily: clone(state.daily), fresh: state.fresh,
        denials: state.denials, waits: state.waits, knownReplays: state.knownReplays, unresolvedResponses: state.unresolved.length,
        pending: !!state.pending, expiryCandidates: clone(state.expiryCandidates), expiryNotices: clone(state.expiryNotices), timerWindows: clone(state.timerWindows),
        retainedConcurrencyEvidence: MARKET_WORLD_CONTRACT.retainedProof, matrixQualifying: false };
    },
    async runDay(day, hooks) {
      assert(Number.isSafeInteger(hooks.logicalAt)); assert.equal(day, state.completedDays.length, 'Run the next market day');
      assert.equal(state.unresolved.length, 0, 'Unresolved completed market replay');
      if (!state.workflow) {
        const previous = state.daily.at(-1); if (previous) assert(hooks.logicalAt >= previous.logicalAt + DAY, 'Market days need a full logical day');
        const plan = planMarketWorld({ seed, roster: configuration.roster, day });
        state.workflow = { day, logicalAt: hooks.logicalAt, plan, tasks: tasksFor(plan), index: 0,
          groups: plan.groups.map(() => ({ saleId: null, saleGood: null, winner: null, orderId: null, returnId: null, refundId: null })),
          result: { day, logicalAt: hooks.logicalAt, participants: roster.length, fresh: 0, denials: 0, waits: 0, refunded: 0, byType: {}, concurrentGroups: 0, serialCompetitionGroups: 0 } };
      }
      assert.equal(state.workflow.logicalAt, hooks.logicalAt, 'Resume this fixed logical market window before advancing time');
      async function record(phase, receipt = null) {
        // The exact pending decisions/responses and cursor are bounded by one
        // small group. Do not repeat growing per-actor receipt histories here;
        // the daily/native full checkpoint retains every component policy.
        await hooks.checkpoint(phase, { version: 1, kind: 'market-incremental-step', configurationSha256, day,
          taskIndex: state.workflow.index, pending: clone(state.pending), receipt: clone(receipt),
          restore: 'Use the full daily/native checkpoint; this record is incremental evidence.' });
      }
      while (state.workflow.index < state.workflow.tasks.length) {
        const cursor = state.workflow, task = cursor.tasks[cursor.index], ids = cursor.plan.groups[task.group], group = cursor.groups[task.group];
        if (!state.pending) {
          const accountIds = task.phase === 'checkin' ? [task.accountId] : task.phase === 'compete' ? ids.slice(1)
            : task.phase === 'fill' ? group.winner ? [group.winner] : []
              : ['refund-order', 'refund-cancel', 'expiry-order'].includes(task.phase) ? [ids.slice(1).find(id => id !== group.winner) || ids[1]] : [ids[0]];
          const items = [];
          for (const accountId of accountIds) { const chosen = await select(task, accountId, hooks, group); if (chosen) items.push(chosen); }
          if (!items.length) { cursor.index++; await record('wait'); continue; }
          state.pending = { taskIndex: cursor.index, items, dispatchState: 'SELECTED', responses: null, settledCount: 0 }; await record('pending');
          if (hooks.pauseBeforeDispatch) return { paused: true };
        }
        const pending = state.pending, continuingResponses = !!pending.responses;
        if (!pending.responses) {
          pending.dispatchState = 'DISPATCHING'; await record('dispatching');
          let responses;
          if (task.phase === 'compete' && hooks.executeGroup && pending.items.length >= 2) {
          const requests = [...pending.items, pending.items[0]].map(item => ({ accountId: item.accountId, request: clone(item.decision.request) }));
          const received = await hooks.executeGroup(requests, { day, group: task.group, sharedListing: group.saleId, boundary: 'quiescent-aggregate' });
          assert.equal(received.length, requests.length); responses = [];
          for (const [index, item] of pending.items.entries()) {
            const matching = index === 0 ? [received[0], received.at(-1)] : [received[index]];
            let response = matching.find(value => value.status === 200 && !value.replayed)
              || matching.find(value => [400, 403, 404].includes(value.status) && !value.replayed);
            if (!response) response = await hooks.execute(item.accountId, clone(item.decision.request));
            responses.push(response);
          }
          cursor.result.concurrentGroups++;
          } else {
            responses = [];
            for (const item of pending.items) responses.push(await hooks.execute(item.accountId, clone(item.decision.request)));
            if (task.phase === 'compete') cursor.result.serialCompetitionGroups++;
          }
          pending.responses = clone(responses); await record('responses');
        }
        while (pending.settledCount < pending.items.length) {
          const index = pending.settledCount;
          if (pending.responses[index].status === 409 || pending.responses[index].status >= 500) {
            assert(continuingResponses, 'Market response remains in progress; retry the exact persisted request');
            const item = pending.items[index]; pending.responses[index] = await hooks.execute(item.accountId, clone(item.decision.request));
            await record('retry-response');
          }
          settle(pending.items[index], pending.responses[index], task, group);
          pending.settledCount++; await record('receipt-settled');
        }
        const settled = pending.items.map(item => state.receipts[item.decision.request.idempotencyKey] || { unresolved: true, accountId: item.accountId });
        state.pending = null; cursor.index++; await record('settled', settled);
        assert.equal(state.unresolved.length, 0, 'Unknown completed replay cannot establish fresh market work');
      }
      const result = clone(state.workflow.result); state.daily.push(result); state.completedDays.push(day); state.workflow = null;
      await hooks.checkpoint('day-complete', api.checkpoint()); return result;
    },
    async runTimerWindow(day, hooks) {
      assert(state.completedDays.includes(day), 'Finish the market day before its expiry observation');
      assert(Number.isSafeInteger(hooks.logicalAt) && hooks.logicalAt >= state.daily[day].logicalAt + 3600000, 'Run original due expiry callbacks first');
      assert(!state.pending && !state.workflow, 'Expiry observation requires a quiescent market actor cursor');
      const awaiting = state.expiryCandidates.filter(candidate => !candidate.resolved && candidate.day <= day);
      const notices = [];
      for (const accountId of [...new Set(awaiting.map(candidate => candidate.accountId))]) {
        const current = await view(accountId, hooks.read);
        const observation = await hooks.read(accountId, '/v1/notifications'); assert(Array.isArray(observation.notifications));
        for (const notification of observation.notifications) {
          const candidate = awaiting.find(candidate => candidate.accountId === accountId && candidate.listingId === notification.payload?.listing);
          if (!candidate || notification.type !== 'order_expired') continue;
          assert(!state.expiryNotices.some(row => row.notificationId === notification.id), 'Expiry notice replay must not duplicate a refund observation');
          assert.equal(current.me.character.id, candidate.characterId); assert(Number.isFinite(notification.payload.refunded) && notification.payload.refunded >= 0);
          candidate.resolved = true;
          const notice = { day, accountId, listingId: candidate.listingId, notificationId: notification.id,
            logicalAt: hooks.logicalAt, reportedRefund: notification.payload.refunded, awaiting: notification.payload.awaiting,
            authority: 'Own canonical expiry notification; actual cash movement is independently measured by the resource journal' };
          state.expiryNotices.push(notice); notices.push(notice);
        }
        await hooks.decision({ day, accountId, phase: 'expiry-observation', logicalAt: hooks.logicalAt }, { current, observation }, { kind: 'observation' });
      }
      const result = { day, logicalAt: hooks.logicalAt, observed: notices.length, unresolvedCandidates: state.expiryCandidates.filter(candidate => !candidate.resolved && candidate.day <= day).length };
      state.timerWindows.push(result); await hooks.checkpoint('timer-window', api.checkpoint()); return clone(result);
    },
  };
  return api;
}
