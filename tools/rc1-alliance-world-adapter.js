// Actor-only integration for the native runner. No database/diagnostic capability.
import assert from 'node:assert/strict';
import { createAlliancePolicy, ALLIANCE_POLICY_CONTRACT } from './rc1-alliance-policy.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

export const ALLIANCE_WORLD_CONTRACT = Object.freeze({ version: 1,
  policy: ALLIANCE_POLICY_CONTRACT,
  schedule: 'Exactly 25 ordinary entrants. All 25 receive one eligible canonical crime session at hours 0 and 24. Three founders form Families, pact, discover and explicitly share at hour 0; authorized conclusions execute at hour 24 after intervening original workers and season rollover.',
  fixtures: 'Only the first three actors receive initialization respect sufficient for level 75. No cash, membership, item, balance, deadline or ACL fixtures. Formation/check-in are measured canonical operations.',
  isolation: 'Pacts grant no Knowledge ACL. Explicit owner-issued account targets and current claim/action revisions remain required. No cross-Family operation authority.',
  restart: 'Every chosen request is checkpointed/restored before dispatch, including original component pending state. Process-level database continuation is deliberately unsupported for this adapter; observation and exact fresh-world replay are separate from continuation.',
  scope: '48-hour/25-actor/one-seed component only; full resources, 90 days and matrix remain unqualified.' });

const clone = structuredClone;
export function createAllianceWorldAdapter({ seed, roster }) {
  assert.equal(roster.length, 25); assert.equal(new Set(roster.map(a => a.accountId)).size, 25);
  assert(roster.every(a => typeof a.accountId === 'string' && typeof a.characterId === 'string' && typeof a.name === 'string'));
  const configuration = { seed, roster: roster.map(({ accountId, characterId, name }) => ({ accountId, characterId, name })) };
  let policies = new Map(configuration.roster.slice(0, 3).map(a => [a.accountId, createAlliancePolicy({ accountId: a.accountId, seed })]));
  let state = { version: 1, configuration: clone(configuration), completedStages: [], families: {}, claims: {}, pending: null,
    receipts: [], unknownResponses: [], controls: [], completions: [], fresh: 0, exactReplays: 0, waits: 0 };
  function validate(value) {
    assert.equal(value.version, 1); assert.deepEqual(value.configuration, configuration);
    assert.deepEqual(value.completedStages, [...new Set(value.completedStages)].sort());
    assert(value.completedStages.every(d => d === 0 || d === 1));
    assert.equal(new Set(value.receipts.map(r => r.request.idempotencyKey)).size, value.receipts.length);
    assert.equal(value.fresh, value.receipts.filter(r => r.status === 200).length);
    for (const field of ['fresh', 'exactReplays', 'waits']) assert(Number.isSafeInteger(value[field]) && value[field] >= 0);
    if (value.pending) assert(configuration.roster.some(a => a.accountId === value.pending.accountId));
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
      state.pending = { accountId: actor.accountId, decision: clone(decision), authorizedViewSha256: actorValueHash(view) };
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
    async runStage(day, { logicalAt, read, execute, decision: recordDecision, checkpoint: recordCheckpoint, retry }) {
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
        const projection = await view(index, extra.targetLabel, ['checkin', 'formation'].includes(phase));
        const options = { logicalAt, ...extra }, selected = api.choose(index, phase, projection, options);
        await recordDecision({ day, accountId: founders[index].accountId, phase, logicalAt }, projection, selected);
        if (selected.kind === 'wait') return { decision: selected, response: null };
        const saved = api.checkpoint(); await recordCheckpoint('pending', saved); api.restore(saved);
        assert.deepEqual(api.choose(index, phase, projection, options), selected);
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
        for (let i = 0; i < 3; i++) {
          const first = await view(i); assert.equal(first.diplomacy.relations.filter(r => r.active).length, 2);
          let last;
          for (let j = 0; j < 4; j++) { if ((await view(i)).instance.status === 'completed') break; last = await act(i, 'act'); }
          const current = await view(i); assert.equal(current.instance.status, 'completed');
          assert(current.instance.nodes.some(n => n.id === 'conclusion' && n.status === 'completed'));
          state.completions.push({ accountId: founders[i].accountId, familyId: current.me.character.gang.id, logicalAt,
            instance: current.instance, reward: 0 });
          assert(last?.response); const response = await retry(founders[i].accountId, last.decision.request); api.settle(i, last.decision, response);
        }
        await refuse(outsider.accountId, '/v1/coordination/knowledge/' + state.claims[founders[1].accountId], 'outsider-after-workers');
      }
      state.completedStages.push(day); await recordCheckpoint('stage-complete', api.checkpoint());
    },
  };
  return api;
}
