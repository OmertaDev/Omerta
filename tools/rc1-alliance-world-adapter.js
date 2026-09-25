// Actor-only integration for the native runner. No database/diagnostic capability.
import assert from 'node:assert/strict';
import { createAlliancePolicy, ALLIANCE_POLICY_CONTRACT } from './rc1-alliance-policy.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

export const ALLIANCE_WORLD_CONTRACT = Object.freeze({ version: 2,
  policy: ALLIANCE_POLICY_CONTRACT,
  schedule: 'Exactly 25 ordinary entrants. All 25 receive one eligible canonical crime session at hours 0 and 24. Three founders form Families, pact, discover and explicitly share at hour 0; authorized conclusions execute at hour 24 after intervening original workers and season rollover.',
  fixtures: 'Only the first three actors receive initialization respect sufficient for level 75. No cash, membership, item, balance, deadline or ACL fixtures. Formation/check-in are measured canonical operations.',
  isolation: 'Pacts grant no Knowledge ACL. Explicit owner-issued account targets and current claim/action revisions remain required. No cross-Family operation authority.',
  restart: 'A quiescent hour-24 checkpoint can retain the first selected, undispatched conclusion action. Stage cursor and exact request are restored; completed stages/actions are not repeated. Actual process startup callbacks run again. Continuation replay compares the same checkpoint and startup path, not an invented uninterrupted equivalence.',
  scope: '48-hour/25-actor/one-seed component only; full resources, 90 days and matrix remain unqualified.' });

const clone = structuredClone;
export function createAllianceWorldAdapter({ seed, roster, mode = 'legacy' }) {
  assert(['legacy', 'continuous'].includes(mode), 'Unknown alliance adapter mode');
  if (mode === 'continuous') return createContinuousAllianceWorldAdapter({ seed, roster });
  assert.equal(roster.length, 25); assert.equal(new Set(roster.map(a => a.accountId)).size, 25);
  assert(roster.every(a => typeof a.accountId === 'string' && typeof a.characterId === 'string' && typeof a.name === 'string'));
  const configuration = { seed, roster: roster.map(({ accountId, characterId, name }) => ({ accountId, characterId, name })) };
  let policies = new Map(configuration.roster.slice(0, 3).map(a => [a.accountId, createAlliancePolicy({ accountId: a.accountId, seed })]));
  let state = { version: 2, configuration: clone(configuration), completedStages: [], families: {}, claims: {}, pending: null, workflow: null,
    receipts: [], unknownResponses: [], controls: [], completions: [], fresh: 0, exactReplays: 0, waits: 0 };
  function validate(value) {
    assert.equal(value.version, 2); assert.deepEqual(value.configuration, configuration);
    assert.deepEqual(value.completedStages, [...new Set(value.completedStages)].sort());
    assert(value.completedStages.every(d => d === 0 || d === 1));
    assert.equal(new Set(value.receipts.map(r => r.request.idempotencyKey)).size, value.receipts.length);
    assert.equal(value.fresh, value.receipts.filter(r => r.status === 200).length);
    for (const field of ['fresh', 'exactReplays', 'waits']) assert(Number.isSafeInteger(value[field]) && value[field] >= 0);
    if (value.pending) {
      assert(configuration.roster.some(a => a.accountId === value.pending.accountId));
      assert(['SELECTED', 'DISPATCHING'].includes(value.pending.dispatchState));
    }
    if (value.workflow) {
      assert.equal(value.workflow.day, 1); assert(value.completedStages.includes(0) && !value.completedStages.includes(1));
      assert(Number.isSafeInteger(value.workflow.index) && value.workflow.index >= 0 && value.workflow.index <= 3);
      assert(['verify', 'progress', 'conclusion', 'retry', 'outsider'].includes(value.workflow.phase));
      assert(Number.isSafeInteger(value.workflow.actions) && value.workflow.actions >= 0 && value.workflow.actions <= 4);
    }
  }
  function own(index, view) {
    assert(Number.isSafeInteger(index) && index >= 0 && index < 3);
    const actor = configuration.roster[index]; assert.equal(view.accountId, actor.accountId);
    assert.equal(view.session?.authed, true); assert.equal(view.session.character?.id, actor.characterId);
    assert.equal(view.me?.character?.id, actor.characterId); return actor;
  }
  const api = {
    roster(day) { assert(day === 0 || day === 1); return configuration.roster.map(a => a.accountId); },
    checkpoint() {
      validate(state); const payload = { state: clone(state), policies: Object.fromEntries([...policies].map(([id, p]) => [id, p.checkpoint()])) };
      return { payload, sha256: actorValueHash(payload) };
    },
    restore(value) {
      assert.equal(value.sha256, actorValueHash(value.payload), 'Adapter checkpoint checksum differs'); validate(value.payload.state);
      assert.deepEqual(Object.keys(value.payload.policies).sort(), [...policies.keys()].sort());
      const restored = new Map([...policies.keys()].map(accountId => [accountId,
        createAlliancePolicy({ accountId, seed }).restore(value.payload.policies[accountId])]));
      const pending = value.payload.state.pending;
      for (const [accountId, p] of restored) {
        const componentPending = p.checkpoint().payload.pending;
        if (componentPending) assert(pending?.accountId === accountId && actorValueHash(pending.decision) === actorValueHash(componentPending), 'Pending component/adapter mismatch');
      }
      state = clone(value.payload.state); policies = restored; return api;
    },
    choose(index, phase, view, options) {
      const actor = own(index, view);
      assert.equal(state.unknownResponses.length, 0, 'Unresolved adapter response');
      if (state.pending) { assert.equal(state.pending.accountId, actor.accountId, 'Resolve current actor first'); return clone(state.pending.decision); }
      let decision;
      if (phase === 'checkin' || phase === 'formation') {
        assert(Object.keys(view).every(k => ['accountId', 'session', 'me', 'rules'].includes(k)), 'Unapproved setup input');
        assert(Number.isSafeInteger(options.logicalAt));
        const ch = view.me.character;
        assert(ch.alive !== false && ch.jailSeconds === 0, 'Founder not currently eligible');
        if (phase === 'formation') {
          assert(!ch.gang && ch.level >= 75, 'Founder eligibility absent');
          assert(Number.isFinite(view.rules.family?.foundCost) && ch.cash >= view.rules.family.foundCost, 'Insufficient public formation cost');
        }
        const request = { method: 'POST', path: phase === 'checkin' ? '/v1/checkin' : '/v1/gangs',
          body: phase === 'checkin' ? {} : { name: 'World Alliance ' + index, tag: 'W' + index } };
        request.idempotencyKey = 'rc1-alliance-world-' + actorValueHash([configuration.seed, actor.accountId, state.receipts.length, request]);
        decision = { kind: 'command', phase, type: phase, logicalAt: options.logicalAt, characterId: actor.characterId, request };
      } else decision = policies.get(actor.accountId).choose(view, { ...options, phase });
      if (decision.kind === 'wait') { state.waits++; return decision; }
      state.pending = { accountId: actor.accountId, decision: clone(decision), authorizedViewSha256: actorValueHash(view), dispatchState: 'SELECTED' };
      return clone(decision);
    },
    settle(index, decision, response) {
      const actor = configuration.roster[index], key = decision.request.idempotencyKey;
      const known = state.receipts.find(r => r.request.idempotencyKey === key);
      const receiptBody = ({ replayed: _flag, ...body }) => body;
      if (known) {
        assert(response.replayed && response.status === known.status && actorValueHash(receiptBody(response.body)) === actorValueHash(receiptBody(known.body)), 'Conflicting adapter replay');
        if (!['checkin', 'formation'].includes(decision.phase)) policies.get(actor.accountId).settle({ idempotencyKey: key,
          status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: true, response: response.body });
        state.exactReplays++; return;
      }
      assert.equal(state.pending?.accountId, actor.accountId); assert.deepEqual(state.pending.decision, decision, 'Wrong pending request');
      if (!['checkin', 'formation'].includes(decision.phase)) policies.get(actor.accountId).settle({ idempotencyKey: key,
        status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: response.replayed, response: response.body });
      if (response.status === 200 && response.replayed) state.unknownResponses.push({ decision: clone(decision), response: clone(response) });
      else {
        if (response.status === 200) {
          if (decision.phase === 'formation') { assert.equal(response.body.ok, true); assert.equal(typeof response.body.gangId, 'string'); state.families[actor.accountId] = response.body.gangId; }
          if (decision.phase === 'checkin') assert.equal(response.body.ok, true);
          state.fresh++;
        }
        state.receipts.push({ accountId: actor.accountId, request: clone(decision.request), status: response.status, body: clone(response.body) });
      }
      state.pending = null; validate(state);
    },
    summary() { return { completedStages: clone(state.completedStages), families: clone(state.families), claims: clone(state.claims),
      fresh: state.fresh, exactReplays: state.exactReplays, waits: state.waits, unknownResponses: state.unknownResponses.length,
      controls: clone(state.controls), completions: clone(state.completions),
      policies: Object.fromEntries([...policies].map(([id, p]) => [id, p.summary()])) }; },
    async runStage(day, { logicalAt, read, execute, decision: recordDecision, checkpoint: recordCheckpoint, retry, pauseBeforeDispatch = false }) {
      assert(day === 0 || day === 1); assert(!state.completedStages.includes(day));
      assert(day === 0 || state.completedStages.includes(0));
      const founders = configuration.roster.slice(0, 3), outsider = configuration.roster[3];
      async function view(index, targetLabel = null, setup = false) {
        const actor = founders[index], get = path => read(actor.accountId, path);
        const projection = { accountId: actor.accountId, session: await get('/v1/session'), me: await get('/v1/me'), rules: await get('/v1/rules') };
        if (setup) return projection;
        projection.directory = await get('/v1/gangs'); projection.diplomacy = await get('/v1/diplomacy');
        projection.catalog = await get('/v1/coordination'); projection.knowledge = await get('/v1/coordination/knowledge');
        projection.targets = await get('/v1/coordination/knowledge/targets' + (targetLabel ? '?characterName=' + encodeURIComponent(targetLabel) : ''));
        const instanceId = policies.get(actor.accountId).summary().instanceId;
        projection.instance = instanceId ? await get('/v1/coordination/instances/' + instanceId) : null; return projection;
      }
      async function act(index, phase, extra = {}) {
        if (state.pending) {
          assert.equal(day, 1); assert.equal(state.pending.accountId, founders[index].accountId);
          assert.equal(state.pending.dispatchState, 'SELECTED', 'Unfinished dispatch cannot be resumed as a new request');
          const selected = clone(state.pending.decision); assert.equal(selected.phase, phase);
          await recordCheckpoint('continued-pending', api.checkpoint()); state.pending.dispatchState = 'DISPATCHING';
          const response = await execute(founders[index].accountId, selected.request);
          api.settle(index, selected, response); await recordCheckpoint('settled', api.checkpoint());
          assert.equal(response.status, 200, JSON.stringify(response)); return { decision: selected, response };
        }
        const projection = await view(index, extra.targetLabel, ['checkin', 'formation'].includes(phase));
        const options = { logicalAt, ...extra }, selected = api.choose(index, phase, projection, options);
        await recordDecision({ day, accountId: founders[index].accountId, phase, logicalAt }, projection, selected);
        if (selected.kind === 'wait') return { decision: selected, response: null };
        const saved = api.checkpoint(); await recordCheckpoint('pending', saved); api.restore(saved);
        assert.deepEqual(api.choose(index, phase, projection, options), selected);
        if (pauseBeforeDispatch) { assert.equal(day, 1); return { paused: true }; }
        state.pending.dispatchState = 'DISPATCHING';
        const response = await execute(founders[index].accountId, selected.request);
        api.settle(index, selected, response); await recordCheckpoint('settled', api.checkpoint());
        assert.equal(response.status, 200, JSON.stringify(response)); return { decision: selected, response };
      }
      async function refuse(accountId, path, label) {
        const response = await read(accountId, path, 404); assert.equal(response.error, 'coordination_unavailable');
        state.controls.push({ day, accountId, path, label, status: 404 });
      }
      if (day === 0) {
        for (let i = 0; i < 3; i++) { await act(i, 'checkin'); await act(i, 'formation'); }
        for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
          await act(from, 'pact', { targetFamilyId: state.families[founders[to].accountId] });
          await act(to, 'pact', { targetFamilyId: state.families[founders[from].accountId] });
        }
        for (let i = 0; i < 3; i++) {
          await act(i, 'travel', { districtId: i === 1 ? 'foundry' : 'docks' }); await act(i, 'create');
          for (let j = 0; j < 3; j++) await act(i, 'act');
          const current = await view(i); assert.equal(current.instance.actions.length, 0, 'Missing independent-evidence gate');
          assert.equal(current.knowledge.claims.length, 1); const claim = current.knowledge.claims[0]; assert(claim.owned);
          assert.equal(claim.source.root, i === 1 ? 'foundry.impression' : 'docks.manifest');
          state.claims[founders[i].accountId] = claim.id;
        }
        for (const [reader, owner] of [[0, 1], [1, 2], [2, 0]]) await refuse(founders[reader].accountId,
          '/v1/coordination/knowledge/' + state.claims[founders[owner].accountId], 'pact-does-not-grant');
        await refuse(outsider.accountId, '/v1/coordination/knowledge/' + state.claims[founders[1].accountId], 'ordinary-outsider');
        for (const [from, to] of [[1, 0], [0, 1], [1, 2], [2, 1]]) {
          const saved = await act(from, 'share', { targetLabel: founders[to].name, claimId: state.claims[founders[from].accountId] });
          if (from === 1 && to === 0) { const response = await retry(founders[from].accountId, saved.decision.request); api.settle(from, saved.decision, response); }
        }
      } else {
        state.workflow ||= { day: 1, index: 0, phase: 'verify', actions: 0, last: null };
        while (state.workflow.index < 3) {
          const cursor = state.workflow, i = cursor.index;
          if (cursor.phase === 'verify') {
            const first = await view(i); assert.equal(first.diplomacy.relations.filter(r => r.active).length, 2);
            cursor.phase = 'progress';
          }
          if (cursor.phase === 'progress') {
            while (state.pending || (await view(i)).instance.status !== 'completed') {
              assert(state.workflow.actions < 4, 'Conclusion action bound exceeded');
              const next = await act(i, 'act'); if (next.paused) return { paused: true };
              // act restores a serialized checkpoint: reacquire the cursor object.
              state.workflow.last = next; state.workflow.actions++;
            }
            state.workflow.phase = 'conclusion';
          }
          if (state.workflow.phase === 'conclusion') {
            const current = await view(i); assert.equal(current.instance.status, 'completed');
            assert(current.instance.nodes.some(n => n.id === 'conclusion' && n.status === 'completed'));
            state.completions.push({ accountId: founders[i].accountId, familyId: current.me.character.gang.id, logicalAt,
              instance: current.instance, reward: 0 });
            state.workflow.phase = 'retry';
          }
          if (state.workflow.phase === 'retry') {
            const last = state.workflow.last; assert(last?.response);
            const response = await retry(founders[i].accountId, last.decision.request); api.settle(i, last.decision, response);
            state.workflow = { day: 1, index: i + 1, phase: i === 2 ? 'outsider' : 'verify', actions: 0, last: null };
          }
        }
        await refuse(outsider.accountId, '/v1/coordination/knowledge/' + state.claims[founders[1].accountId], 'outsider-after-workers');
        state.workflow = null;
      }
      state.completedStages.push(day); await recordCheckpoint('stage-complete', api.checkpoint());
    },
  };
  return api;
}

export const ALLIANCE_CONTINUOUS_WORLD_CONTRACT = Object.freeze({ version: 3,
  legacy: ALLIANCE_WORLD_CONTRACT,
  populations: [25, 100, 250, 500, 1000], seeds: ['rc1-alpha', 'rc1-beta', 'rc1-gamma'],
  schedule: 'All roster identities receive the runner\'s daily canonical activity. Days zero and one retain the original three-founder workflow. Every later day checks all three Families, renews publicly expired pacts, checks in, revokes prior delegate grants, and explicitly shares current owned evidence with three rotating ordinary delegates.',
  delegates: 'Delegates verify their actual grant, travel to the complementary public source when eligible, and progress only their own currently issued Split Ledger actions. Each character has one canonical case; completed cases are never represented as newly completed on later days.',
  cooperation: 'A later day succeeds only with three fresh explicit account grants, three successful recipient reads, three distinct current founder Families, and no unresolved response. Revocation controls must refuse former readers. Daily crimes remain the runner\'s separate canonical activity.',
  continuation: 'Explicit version-three full checkpoints embed the unchanged version-two initial workflow, active delegate policy cursors, and daily task cursor. Daily completion and checkpoint() retain full restore state. Intermediate evidence retains exact pending request/cursor, affected actor policy and newly settled receipt; it is explicitly not a restore checkpoint. Unknown completed replays stop progress.',
  fixtures: 'Only the existing three initialization respect fixtures. No postbaseline grants, ACL writes, progression writes, or repeated instance fabrication.',
  scope: 'Continuous actor component; no native duration, lifecycle, resource, population capacity or matrix qualification is inferred.' });

function createContinuousAllianceWorldAdapter({ seed, roster }) {
  assert(ALLIANCE_CONTINUOUS_WORLD_CONTRACT.populations.includes(roster.length));
  assert(ALLIANCE_CONTINUOUS_WORLD_CONTRACT.seeds.includes(seed));
  assert.equal(new Set(roster.map(a => a.accountId)).size, roster.length);
  assert(roster.every(a => typeof a.accountId === 'string' && typeof a.characterId === 'string' && typeof a.name === 'string'));
  const configuration = { seed, roster: roster.map(({ accountId, characterId, name }) => ({ accountId, characterId, name })) };
  const configurationSha256 = actorValueHash(configuration);
  const founders = configuration.roster.slice(0, 3), outsiders = configuration.roster.slice(3);
  let legacy = createAllianceWorldAdapter({ seed, roster: configuration.roster.slice(0, 25) }), delegates = new Map();
  let state = { version: 3, configuration: clone(configuration), completedStages: [], previousDelegates: [], workflow: null,
    pending: null, receipts: [], daily: [], completions: [], controls: [], waits: 0, initialWaits: 0 };
  const actorFor = accountId => { const actor = configuration.roster.find(a => a.accountId === accountId); assert(actor); return actor; };
  const founderIndex = accountId => founders.findIndex(a => a.accountId === accountId);
  const delegatePolicy = accountId => {
    assert(outsiders.some(a => a.accountId === accountId));
    if (!delegates.has(accountId)) delegates.set(accountId, createAlliancePolicy({ accountId, seed }));
    return delegates.get(accountId);
  };
  const unresolved = () => legacy.summary().unknownResponses + [...delegates.values()].reduce((n, p) => n + p.summary().unresolvedReplays, 0);
  function validate(value) {
    assert.equal(value.version, 3, 'Continuous mode requires a version-three checkpoint');
    assert.deepEqual(value.configuration, configuration);
    assert.deepEqual(value.completedStages, Array.from({ length: value.completedStages.length }, (_, day) => day));
    assert(value.previousDelegates.length === 0 || value.previousDelegates.length === 3);
    assert(value.previousDelegates.every(accountId => outsiders.some(a => a.accountId === accountId)));
    for (const field of ['waits', 'initialWaits']) assert(Number.isSafeInteger(value[field]) && value[field] >= 0);
    assert.equal(new Set(value.receipts.map(r => r.request.idempotencyKey)).size, value.receipts.length);
    assert.equal(new Set(value.completions.map(r => r.accountId)).size, value.completions.length, 'A delegate case cannot complete twice');
    assert.deepEqual(value.daily.map(d => d.day), value.completedStages.filter(day => day >= 2));
    if (value.workflow) {
      assert.equal(value.workflow.day, value.completedStages.length); assert(value.workflow.day >= 2);
      assert(Number.isSafeInteger(value.workflow.logicalAt));
      assert(Number.isSafeInteger(value.workflow.index) && value.workflow.index >= 0 && value.workflow.index <= value.workflow.tasks.length);
      assert.equal(value.workflow.delegates.length, 3); assert.equal(new Set(value.workflow.delegates).size, 3);
    }
    if (value.pending) {
      assert(value.workflow && value.pending.taskIndex === value.workflow.index);
      assert.equal(value.workflow.tasks[value.workflow.index].accountId, value.pending.accountId);
      assert(['SELECTED', 'DISPATCHING'].includes(value.pending.dispatchState));
      actorFor(value.pending.accountId);
    }
  }
  function tasksFor(day, selected, previous = state.previousDelegates, initialization = legacy.summary()) {
    const claims = initialization.claims, tasks = [];
    for (const actor of founders) tasks.push({ kind: 'family', accountId: actor.accountId });
    for (const actor of founders) tasks.push({ kind: 'command', accountId: actor.accountId, phase: 'checkin', options: {} });
    for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) for (const [a, b] of [[from, to], [to, from]])
      tasks.push({ kind: 'command', accountId: founders[a].accountId, phase: 'pact', options: { targetFamilyId: initialization.families[founders[b].accountId] } });
    for (let i = 0; i < previous.length; i++) {
      const accountId = previous[i], claimId = claims[founders[i].accountId];
      tasks.push({ kind: 'command', accountId: founders[i].accountId, phase: 'revoke', options: { targetLabel: actorFor(accountId).name, claimId } });
      tasks.push({ kind: 'refuse', accountId, claimId, label: 'former-delegate-after-revoke' });
    }
    for (let i = 0; i < 3; i++) {
      const accountId = selected[i], claimId = claims[founders[i].accountId];
      tasks.push({ kind: 'command', accountId: founders[i].accountId, phase: 'share', options: { targetLabel: actorFor(accountId).name, claimId } });
      tasks.push({ kind: 'grant', accountId, claimId });
      tasks.push({ kind: 'command', accountId, phase: 'travel', options: { districtId: i === 1 ? 'docks' : 'foundry' }, caseWork: true });
      tasks.push({ kind: 'command', accountId, phase: 'create', options: {}, caseWork: true });
      for (let action = 0; action < 8; action++) tasks.push({ kind: 'command', accountId, phase: 'act', options: {}, caseWork: true });
      tasks.push({ kind: 'case', accountId });
    }
    const outsider = outsiders.find(a => !selected.includes(a.accountId));
    tasks.push({ kind: 'refuse', accountId: outsider.accountId, claimId: claims[founders[0].accountId], label: 'unselected-delegate' });
    return tasks;
  }
  const api = {
    roster(day) { assert(Number.isSafeInteger(day) && day >= 0); return configuration.roster.map(a => a.accountId); },
    checkpoint() {
      validate(state);
      const payload = { state: clone(state), legacy: legacy.checkpoint(),
        delegates: Object.fromEntries([...delegates].map(([accountId, policy]) => [accountId, policy.checkpoint()])) };
      return { payload, sha256: actorValueHash(payload) };
    },
    restore(checkpoint) {
      assert.equal(checkpoint.sha256, actorValueHash(checkpoint.payload), 'Continuous checkpoint checksum differs');
      validate(checkpoint.payload.state);
      const restoredLegacy = createAllianceWorldAdapter({ seed, roster: configuration.roster.slice(0, 25) }).restore(checkpoint.payload.legacy);
      assert.deepEqual(restoredLegacy.summary().completedStages, checkpoint.payload.state.completedStages.filter(d => d < 2));
      if (checkpoint.payload.state.workflow) {
        const workflow = checkpoint.payload.state.workflow;
        const selected = [0, 1, 2].map(i => outsiders[((workflow.day - 2) * 3 + i) % outsiders.length].accountId);
        assert.deepEqual(workflow.delegates, selected, 'Continuous delegate schedule differs');
        assert.deepEqual(workflow.tasks, tasksFor(workflow.day, selected, checkpoint.payload.state.previousDelegates, restoredLegacy.summary()),
          'Continuous task schedule differs');
      }
      const restoredDelegates = new Map();
      for (const [accountId, saved] of Object.entries(checkpoint.payload.delegates)) {
        assert(outsiders.some(a => a.accountId === accountId));
        restoredDelegates.set(accountId, createAlliancePolicy({ accountId, seed }).restore(saved));
      }
      const pending = checkpoint.payload.state.pending;
      const componentPending = [
        ...(checkpoint.payload.state.completedStages.length >= 2 ? [[checkpoint.payload.legacy.payload.state.pending?.accountId,
          checkpoint.payload.legacy.payload.state.pending?.decision]] : []),
        ...[...restoredDelegates].map(([id, p]) => [id, p.checkpoint().payload.pending]),
      ].filter(([, decision]) => decision);
      assert.equal(componentPending.length, Number(!!pending), 'Continuous component pending count differs');
      if (pending) assert(componentPending.some(([id, decision]) => id === pending.accountId
        && actorValueHash(decision) === actorValueHash(pending.decision)), 'Continuous component pending identity differs');
      state = clone(checkpoint.payload.state); legacy = restoredLegacy; delegates = restoredDelegates; return api;
    },
    summary() {
      const original = legacy.summary();
      return { ...original, version: 3, completedStages: clone(state.completedStages),
        fresh: original.fresh + [...delegates.values()].reduce((n, p) => n + p.summary().fresh, 0),
        waits: state.initialWaits + state.waits,
        unknownResponses: unresolved(), dailyCooperation: clone(state.daily),
        delegateCompletions: clone(state.completions), continuationPending: !!state.pending || !!legacy.checkpoint().payload.state.pending,
        controls: [...original.controls, ...clone(state.controls)], matrixQualifying: false };
    },
    async runStage(day, hooks) {
      assert(Number.isSafeInteger(day) && day === state.completedStages.length, 'Run exactly the next continuous day');
      assert.equal(unresolved(), 0, 'Unresolved continuous response');
      if (day < 2) {
        const result = await legacy.runStage(day, { ...hooks, checkpoint: async phase => {
          state.completedStages = legacy.summary().completedStages;
          state.initialWaits = legacy.summary().waits;
          await hooks.checkpoint(phase, api.checkpoint());
        } });
        state.completedStages = legacy.summary().completedStages; return result;
      }
      const { logicalAt, read, execute, decision: recordDecision, checkpoint: recordCheckpoint, pauseBeforeDispatch = false } = hooks;
      assert(Number.isSafeInteger(logicalAt));
      if (!state.workflow) {
        const previousAt = state.daily.at(-1)?.logicalAt ?? Math.max(...legacy.summary().completions.map(c => c.logicalAt));
        assert(Number.isFinite(previousAt) && logicalAt >= previousAt + 86400000, 'Continuous days require a full logical day between stages');
        const selected = [0, 1, 2].map(i => outsiders[((day - 2) * 3 + i) % outsiders.length].accountId);
        state.workflow = { day, logicalAt, delegates: selected, tasks: tasksFor(day, selected), index: 0,
          result: { day, logicalAt, delegates: selected, currentFamilies: [], freshGrants: 0, revocations: 0,
            verifiedGrants: 0, freshOperations: 0, delegateActions: 0, newCaseCompletions: 0 } };
      }
      assert.equal(state.workflow.day, day); assert(logicalAt >= state.workflow.logicalAt, 'Continuous clock moved backwards');
      async function view(accountId, targetLabel = null, setup = false) {
        const actor = actorFor(accountId), get = path => read(accountId, path);
        const projection = { accountId, session: await get('/v1/session'), me: await get('/v1/me'), rules: await get('/v1/rules') };
        assert.equal(projection.session?.authed, true); assert.equal(projection.session.character?.id, actor.characterId);
        assert.equal(projection.me.character?.id, actor.characterId, 'Character replacement requires explicit new actor provenance');
        if (setup) return projection;
        projection.directory = await get('/v1/gangs'); projection.diplomacy = await get('/v1/diplomacy');
        projection.catalog = await get('/v1/coordination'); projection.knowledge = await get('/v1/coordination/knowledge');
        projection.targets = await get('/v1/coordination/knowledge/targets' + (targetLabel ? '?characterName=' + encodeURIComponent(targetLabel) : ''));
        const index = founderIndex(accountId), instanceId = index >= 0
          ? legacy.summary().policies[accountId].instanceId : delegatePolicy(accountId).summary().instanceId;
        projection.instance = instanceId ? await get('/v1/coordination/instances/' + instanceId) : null;
        return projection;
      }
      async function recordStep(phase, task, receipt = null) {
        const index = founderIndex(task.accountId), original = index >= 0 ? legacy.checkpoint() : null;
        await recordCheckpoint(phase, { version: 3, kind: 'alliance-incremental-step', configurationSha256,
          day, logicalAt, nextTaskIndex: state.workflow.index, task: clone(task),
          result: clone(state.workflow.result), pending: clone(state.pending), receipt: clone(receipt),
          actorPolicy: task.kind !== 'command' ? null : index >= 0 ? original.payload.policies[task.accountId]
            : delegates.get(task.accountId)?.checkpoint() || null,
          founderPending: original?.payload.state.pending || null,
          restore: 'Use the full daily/native checkpoint; this record is incremental evidence only.' });
      }
      while (state.workflow.index < state.workflow.tasks.length) {
        const cursor = state.workflow, task = cursor.tasks[cursor.index], actor = actorFor(task.accountId);
        let settledReceipt = null;
        if (task.kind === 'command') {
          if (task.caseWork && state.completions.some(c => c.accountId === task.accountId)) { cursor.index++; continue; }
          const index = founderIndex(task.accountId);
          if (!state.pending) {
            const projection = await view(task.accountId, task.options.targetLabel, task.phase === 'checkin');
            let selected;
            if (task.phase === 'checkin' && projection.me.character.jailSeconds > 0)
              selected = { kind: 'wait', phase: task.phase, reason: 'current-public-jail' };
            else if (task.phase === 'act' && !projection.instance)
              selected = { kind: 'wait', phase: task.phase, reason: 'no-current-instance' };
            else selected = index >= 0 ? legacy.choose(index, task.phase, projection, { logicalAt, ...task.options })
              : delegatePolicy(task.accountId).choose(projection, { logicalAt, phase: task.phase, ...task.options });
            await recordDecision({ day, accountId: task.accountId, phase: task.phase, logicalAt }, projection, selected);
            if (selected.kind === 'wait') { state.waits++; cursor.index++; await recordStep('wait', task); continue; }
            const claim = ['share', 'revoke'].includes(task.phase) ? projection.knowledge.claims.find(c => c.id === task.options.claimId) : null;
            state.pending = { accountId: task.accountId, taskIndex: cursor.index, decision: clone(selected), dispatchState: 'SELECTED',
              authorizedViewSha256: actorValueHash(projection), beforeAclRevision: claim?.aclRevision ?? null };
            await recordStep('pending', task);
            if (pauseBeforeDispatch) return { paused: true };
          }
          assert.equal(state.pending.dispatchState, 'SELECTED', 'Unfinished dispatch requires receipt reconciliation');
          assert.equal(state.pending.accountId, actor.accountId);
          const pending = state.pending, selected = pending.decision;
          state.pending.dispatchState = 'DISPATCHING';
          const response = await execute(actor.accountId, selected.request);
          if (index >= 0) legacy.settle(index, selected, response);
          else delegatePolicy(actor.accountId).settle({ idempotencyKey: selected.request.idempotencyKey,
            status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: response.replayed, response: response.body });
          state.pending = null;
          settledReceipt = { day, accountId: actor.accountId, request: clone(selected.request), status: response.status, bodySha256: actorValueHash(response.body) };
          state.receipts.push(settledReceipt);
          assert.equal(unresolved(), 0, 'Unknown completed replay cannot count as fresh cooperation');
          assert.equal(response.status, 200, JSON.stringify(response)); assert.equal(response.replayed, false);
          cursor.result.freshOperations++;
          if (task.phase === 'share' || task.phase === 'revoke') {
            assert.equal(response.body.claim.aclRevision, pending.beforeAclRevision + 1, 'Fresh grant mutation must advance its current ACL revision');
            cursor.result[task.phase === 'share' ? 'freshGrants' : 'revocations']++;
          }
          if (index < 0) cursor.result.delegateActions++;
        } else if (task.kind === 'family') {
          const current = await view(actor.accountId, null, true), family = current.me.character.gang;
          assert.equal(family?.id, legacy.summary().families[actor.accountId], 'Original alliance Family is no longer current');
          assert(['boss', 'underboss'].includes(family.role), 'Founder no longer has public officer authority');
          cursor.result.currentFamilies.push(family.id);
        } else if (task.kind === 'grant') {
          await view(actor.accountId, null, true);
          const detail = await read(actor.accountId, '/v1/coordination/knowledge/' + task.claimId);
          assert.equal(detail.claim?.id, task.claimId); assert.equal(detail.claim.owned, false);
          cursor.result.verifiedGrants++;
        } else if (task.kind === 'refuse') {
          const pathname = '/v1/coordination/knowledge/' + task.claimId;
          const response = await read(actor.accountId, pathname, 404); assert.equal(response.error, 'coordination_unavailable');
          state.controls.push({ day, accountId: actor.accountId, path: pathname, label: task.label, status: 404 });
        } else {
          assert.equal(task.kind, 'case');
          const current = await view(actor.accountId), instance = current.instance;
          if (instance?.status === 'completed' && !state.completions.some(c => c.accountId === actor.accountId)) {
            assert(instance.nodes.some(n => n.id === 'conclusion' && n.status === 'completed'));
            state.completions.push({ accountId: actor.accountId, instanceId: instance.id, day, logicalAt, reward: 0 });
            cursor.result.newCaseCompletions++;
          }
        }
        cursor.index++; await recordStep('step-complete', task, settledReceipt);
      }
      const result = state.workflow.result;
      assert.equal(new Set(result.currentFamilies).size, 3); assert.equal(result.freshGrants, 3); assert.equal(result.verifiedGrants, 3);
      assert.equal(result.revocations, state.previousDelegates.length); assert.equal(unresolved(), 0);
      result.cooperationSatisfied = true; state.previousDelegates = [...state.workflow.delegates];
      state.daily.push(clone(result)); state.completedStages.push(day); state.workflow = null;
      await recordCheckpoint('stage-complete', api.checkpoint()); return clone(result);
    },
  };
  return api;
}
