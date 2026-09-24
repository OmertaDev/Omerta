// Native world actor adapter. Only ordinary authenticated/public projections enter decisions.
import assert from 'node:assert/strict';
import { createFamilyPolicy, planFamilyFixture } from './rc1-family-policy.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

export const FAMILY_WORLD_CONTRACT = Object.freeze({ version: 1,
  initialization: 'Ordinary entry; only planned founders receive pre-baseline level75 respect. Before measurement, original day0 canonical check-in, formation, membership and treasury funding establish the declared Family configuration. Public rosters verify actual legal concentration.',
  schedule: 'Day0 setup is retained before the measured baseline and is not repeated. Every later day all actors consider own daily check-in, public membership and treasury tribute. Ordinary day0 and subsequent PlayerCommands and crime sessions remain measured.',
  information: 'Own session/character, public rules and Family directory/roster only; no diagnostic state or privileged actions.',
  replay: 'Task cursor and exact selected request persist before dispatch. Unknown completed replay remains unresolved; no new choice proceeds.',
  scope: 'Actor workload support; no claim that duration, resources, reachability or matrix qualification passed.' });

export function assessFamilyInitialState(plan, roster, views) {
  assert.equal(roster.length, plan.population);
  const declared = new Set(roster.map(actor => actor.characterId));
  assert.equal(declared.size, roster.length);
  assert.equal(views.length, plan.groups.length);
  assert.equal(new Set(views.map(view => view.gang.id)).size, views.length);
  const members = new Set(), families = views.map((view, index) => {
    const group = plan.groups[index], family = view.gang;
    assert(Array.isArray(family.members) && family.members.length <= plan.canonicalMaximumMembers);
    assert.equal(new Set(family.members.map(member => member.id)).size, family.members.length);
    for (const member of family.members) { assert(!members.has(member.id), 'Character belongs to multiple initial Families'); members.add(member.id); }
    for (const actorIndex of group.members)
      assert(family.members.some(member => member.id === roster[actorIndex].characterId), 'Planned member did not enter its initial Family');
    assert(family.members.some(member => member.id === roster[group.founder].characterId && member.role === 'boss'), 'Initial founder is not boss');
    return { id: family.id, declaredMembers: family.members.filter(member => declared.has(member.id)).length,
      totalMembers: family.members.length, treasury: family.treasury };
  });
  const largest = Math.max(...families.map(family => family.declaredMembers));
  if (plan.scenario === 'family_monopoly') {
    assert.equal(families[0].declaredMembers, plan.canonicalMaximumMembers, 'Initial monopoly did not saturate the original legal cap');
    for (const index of plan.outsiders)
      assert(!views[0].gang.members.some(member => member.id === roster[index].characterId), 'Outsider entered the full initial monopoly');
  } else {
    assert.equal(plan.scenario, 'fragmented_families');
    assert(families.length >= 10 && largest <= Math.floor(roster.length * 0.2), 'Initial fragmentation differs from the frozen legal extreme');
  }
  return { verified: true, families, largestDeclaredFamily: largest,
    largestDeclaredFamilyFraction: { numerator: largest, denominator: roster.length }, legalConstraint: plan.legalConstraint || null,
    scope: 'Actual ordinary public rosters at initialization; legal capacity saturation is not an 80-percent claim for populations above25.' };
}

export function createFamilyWorldAdapter({ scenario, seed, roster }) {
  const plan = planFamilyFixture(scenario, roster.length);
  assert.equal(new Set(roster.map(actor => actor.accountId)).size, roster.length);
  const configuration = { scenario, seed, roster: roster.map(({ accountId, characterId }) => ({ accountId, characterId })) };
  const policyConfig = actor => ({ accountId: actor.accountId, seed, scenario, population: roster.length });
  let policies = new Map(roster.map(actor => [actor.accountId, createFamilyPolicy(policyConfig(actor))]));
  let state = { nextDay: 0, workflow: null, families: {}, pending: null, fresh: 0, denials: 0, waits: 0,
    completedByType: {}, receipts: [], unresolved: [] };
  const taskList = day => {
    const tasks = [];
    if (day === 0) {
      for (const group of plan.groups) tasks.push({ index: group.founder, phase: 'checkin' }, { index: group.founder, phase: 'found' });
      for (const group of plan.groups) for (const index of group.members.slice(1)) tasks.push({ index, phase: 'enter', founder: group.founder });
      for (const index of plan.outsiders) tasks.push({ index, phase: 'enter' });
      for (let index = 0; index < roster.length; index++) tasks.push({ index, phase: 'concentrate' });
    } else for (let index = 0; index < roster.length; index++)
      for (const phase of ['checkin', 'enter', 'tribute']) tasks.push({ index, phase });
    return tasks;
  };
  const validate = () => {
    assert(Number.isSafeInteger(state.nextDay) && state.nextDay >= 0);
    for (const key of ['fresh', 'denials', 'waits']) assert(Number.isSafeInteger(state[key]) && state[key] >= 0);
    assert.equal(state.fresh + state.denials + state.unresolved.length, state.receipts.length);
    assert.equal(new Set(state.receipts.map(row => row.key)).size, state.receipts.length);
    if (state.workflow) {
      assert.equal(state.workflow.day, state.nextDay);
      assert(Number.isSafeInteger(state.workflow.cursor) && state.workflow.cursor >= 0 && state.workflow.cursor <= taskList(state.nextDay).length);
    }
    if (state.pending) assert(state.workflow && state.pending.cursor === state.workflow.cursor);
  };
  const transition = accountId => {
    // Full state is retained at day/final checkpoints. A step retains its exact
    // request, cursor, current actor policy and receipt without copying every
    // other actor's ever-growing receipt history into each history event.
    const payload = { version: 1, kind: 'family-world-transition', configurationSha256: actorValueHash(configuration),
      accountId, nextDay: state.nextDay, workflow: state.workflow, families: state.families, pending: state.pending,
      fresh: state.fresh, denials: state.denials, waits: state.waits, completedByType: state.completedByType,
      receiptCount: state.receipts.length, lastReceipt: state.receipts.at(-1) || null,
      unresolved: state.unresolved, policy: policies.get(accountId).checkpoint() };
    return { payload: structuredClone(payload), sha256: actorValueHash(payload) };
  };
  const api = {
    roster(day) { assert(Number.isSafeInteger(day) && day >= 0); return roster.map(actor => actor.accountId); },
    checkpoint() {
      validate(); const payload = { version: 1, configuration, state,
        policies: Object.fromEntries([...policies].map(([id, policy]) => [id, policy.checkpoint()])) };
      return { payload: structuredClone(payload), sha256: actorValueHash(payload) };
    },
    restore(checkpoint) {
      assert.equal(actorValueHash(checkpoint.payload), checkpoint.sha256); assert.equal(checkpoint.payload.version, 1);
      assert.deepEqual(checkpoint.payload.configuration, configuration);
      state = structuredClone(checkpoint.payload.state);
      policies = new Map(roster.map(actor => [actor.accountId, createFamilyPolicy(policyConfig(actor)).restore(checkpoint.payload.policies[actor.accountId])]));
      validate(); return api;
    },
    summary() { validate(); return { nextDay: state.nextDay, families: structuredClone(state.families),
      fresh: state.fresh, denials: state.denials, waits: state.waits, completedByType: structuredClone(state.completedByType),
      unresolvedResponses: state.unresolved.length, pending: !!state.pending, plan, matrixQualifying: false }; },
    async runDay(day, { logicalAt, read, execute, decision, checkpoint }) {
      assert.equal(day, state.nextDay); assert.equal(state.unresolved.length, 0, 'Unresolved Family world replay');
      state.workflow ||= { day, cursor: 0 };
      const tasks = taskList(day);
      while (state.workflow.cursor < tasks.length) {
        const cursor = state.workflow.cursor, task = tasks[cursor], actor = roster[task.index], policy = policies.get(actor.accountId);
        const get = path => read(actor.accountId, path);
        let selected = state.pending?.selected;
        if (!selected) {
          const view = { accountId: actor.accountId, session: await get('/v1/session'), me: await get('/v1/me'),
            directory: await get('/v1/gangs'), rules: await get('/v1/rules') };
          assert.equal(view.session.character?.id, actor.characterId, 'Family actor generation changed; explicit heir transition required');
          view.family = view.me.character.gang ? await get('/v1/gangs/' + view.me.character.gang.id) : null;
          if (task.phase === 'checkin') {
            assert.equal(typeof view.me.character.checkin?.done, 'boolean');
            selected = view.me.character.checkin.done ? { kind: 'wait', reason: 'already-checked-in' }
              : { kind: 'command', type: 'family.checkin', request: { method: 'POST', path: '/v1/checkin', body: {},
                idempotencyKey: 'rc1-family-day-' + actorValueHash([configuration, day, cursor, actor.characterId]) } };
          } else selected = policy.choose(view, { logicalAt, phase: task.phase,
            targetFamilyId: task.founder === undefined ? null : state.families[task.founder] });
          await decision({ day, cursor, logicalAt, accountId: actor.accountId, phase: task.phase }, view, selected);
          if (selected.kind === 'wait') { state.waits++; state.workflow.cursor++; continue; }
          state.pending = { cursor, selected }; await checkpoint('pending', transition(actor.accountId));
        }
        const response = await execute(actor.accountId, selected.request);
        assert([200, 400].includes(response.status), JSON.stringify(response));
        const status = response.status === 200 ? 'COMPLETED' : 'DENIED';
        if (selected.type !== 'family.checkin') policy.settle({ idempotencyKey: selected.request.idempotencyKey,
          status, replayed: response.replayed, response: response.body });
        if (response.replayed && status === 'COMPLETED') state.unresolved.push({ selected, response });
        else if (status === 'COMPLETED') {
          state.fresh++; state.completedByType[selected.type] = (state.completedByType[selected.type] || 0) + 1;
          if (task.phase === 'found') { assert.equal(typeof response.body.gangId, 'string'); state.families[task.index] = response.body.gangId; }
        } else state.denials++;
        state.receipts.push({ key: selected.request.idempotencyKey, status, responseSha256: actorValueHash(response) });
        state.pending = null; state.workflow.cursor++; await checkpoint('settled', transition(actor.accountId));
        assert.equal(state.unresolved.length, 0, 'Unknown completed Family world replay');
        if (day === 0 && ['checkin', 'found'].includes(task.phase)) assert.equal(response.status, 200, 'Required canonical Family formation failed');
      }
      state.nextDay++; state.workflow = null; await checkpoint('day-complete', api.checkpoint());
      return api.summary();
    },
  };
  return api;
}
