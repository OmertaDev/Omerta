// Repeated sealed turf competition. Actor inputs are ordinary authenticated/public HTTP bodies.
import assert from 'node:assert/strict';
import { createFamilyPolicy } from './rc1-family-policy.js';
import { createTurfPolicy } from './rc1-turf-policy.js';
import { actorValueHash as hash } from './rc1-native-actor-replay.js';

const DAY = 86400000, clone = value => structuredClone(value);
export const WAR_WORLD_CONTRACT = Object.freeze({ version: 1,
  initialization: 'Retained turf fixture: only planned founders receive level400 respect before preparation. Ordinary entry cash500/ammo25; actual first check-in140000, formation25000, tribute100000 and vacant Cathedral seizure. All membership, money and district changes use original handlers. Capture measured baseline only after prepare completes.',
  schedule: 'All declared actors consider daily check-in, quiet progression and own Family treasury concentration. At least three planned opposing Families share Cathedral; each founder chooses a sealed claim using only own treasury and public floor. All successful commitments require own canonical settlement receipts before another daily round.',
  information: 'Own session/me, public rules and Family directory for setup/membership; turf policy receives only own session/me, public districts and own notifications. No rival balances or observer state enter sealed stake choices.',
  notifications: 'GET /v1/notifications marks messages delivered. Runner read must durably retain original HTTP responses and replay interrupted reads from its journal. Settlement observations retain delivered bodies before processing, filter prior-round receipts, and run after original hourly workers. Elapsed timers never establish settlement.',
  hooks: 'read(accountId,path) returns a retained HTTP body; execute(accountId,request) returns {status,replayed,body}; await record(event) durably before mutation. Caller retains full checkpoint at existing serial/fault boundaries and advances original workers. prepare/runDay/observeSettlements are bounded; never interleave clock advancement inside an unfinished day.',
  scope: 'Frozen multi_family_war criterion: minimum3 opposing Families on overlapping scarce objectives, using retained turf lifecycle evidence. No three-way war_with declaration, new gate, hidden grant, resource conservation or completed matrix claim.' });

export function planWarWorld(population) {
  assert([25, 100, 250, 500, 1000].includes(population));
  const count = Math.max(3, Math.ceil(population / 20));
  return { scenario: 'multi_family_war', population, founderLevel: 400, canonicalMaximumMembers: 20,
    minimumOpposingFamilies: 3, districtId: 'cathedral',
    groups: Array.from({ length: count }, (_, founder) => ({ founder,
      members: Array.from({ length: population }, (_, index) => index).filter(index => index % count === founder) })) };
}

export function createWarWorldAdapter({ seed, roster, epoch }) {
  assert(typeof seed === 'string' && seed.length); assert(Number.isSafeInteger(epoch) && epoch >= 0);
  roster = roster.map(({ accountId, characterId }) => ({ accountId, characterId }));
  const plan = planWarWorld(roster.length), districtId = plan.districtId;
  for (const key of ['accountId', 'characterId']) {
    assert(roster.every(actor => typeof actor[key] === 'string' && /^[a-zA-Z0-9_-]+$/.test(actor[key])));
    assert.equal(new Set(roster.map(actor => actor[key])).size, roster.length);
  }
  const configuration = { seed, roster, epoch }, configurationHash = hash(configuration), familyCount = plan.groups.length;
  // Explicit assigned targets reuse public membership/funding selectors; no monopoly outcome is claimed.
  const familyConfig = index => ({ accountId: roster[index].accountId, seed: seed + ':war',
    scenario: 'family_monopoly', population: roster.length });
  const turfConfig = (index, day) => ({ accountId: roster[index].accountId,
    seed: seed + ':war:day:' + day, commitBps: [7000, 6000, 8000][index % 3] });
  let families = roster.map((_, index) => createFamilyPolicy(familyConfig(index))), turfs = new Map();
  let state = { prepared: false, prepCursor: 0, nextDay: 0, workflow: null, familyIds: {},
    rounds: [], active: {}, observeCursor: 0, pending: null, failure: null,
    fresh: 0, denied: 0, waits: 0, completedByType: {}, unresolved: [] };
  const prepTasks = [
    ...roster.map((_, index) => ({ index, phase: 'entry' })),
    ...plan.groups.flatMap(({ founder: index }) => [{ index, phase: 'checkin' }, { index, phase: 'found' }]),
    ...plan.groups.flatMap(group => group.members.slice(1).map(index => ({ index, phase: 'enter' }))),
    ...plan.groups.map(({ founder: index }) => ({ index, phase: 'fund' })),
    { index: 0, phase: 'seize' }, ...roster.map((_, index) => ({ index, phase: 'membership' })),
    { index: 0, phase: 'holder' },
  ];
  const dayTasks = ['checkin', 'progress', 'concentrate'].flatMap(phase => roster.map((_, index) => ({ index, phase })))
    .concat(plan.groups.map(({ founder: index }) => ({ index, phase: 'claim' })));
  const cursor = mode => mode === 'prepare' ? state.prepCursor : state.workflow.cursor;
  const advance = mode => { if (mode === 'prepare') state.prepCursor++; else state.workflow.cursor++; };
  const activeCommitments = () => [...turfs.values()].filter(policy => policy.summary().commitment && !policy.summary().outcome).length;
  const validate = () => {
    assert(Number.isSafeInteger(state.nextDay) && state.nextDay >= 0);
    assert(Number.isSafeInteger(state.prepCursor) && state.prepCursor >= 0 && state.prepCursor <= prepTasks.length);
    assert.equal(state.prepared, state.prepCursor === prepTasks.length);
    for (const key of ['fresh', 'denied', 'waits']) assert(Number.isSafeInteger(state[key]) && state[key] >= 0);
    assert.equal(Object.values(state.completedByType).reduce((a, b) => a + b, 0), state.fresh);
    assert.equal(state.rounds.length, state.nextDay + Number(!!state.workflow));
    assert.equal(new Set(Object.values(state.familyIds)).size, Object.keys(state.familyIds).length);
    if (state.prepared) assert.equal(Object.keys(state.familyIds).length, familyCount);
    if (state.workflow) {
      assert(state.prepared); assert.equal(state.workflow.day, state.nextDay);
      assert(Number.isSafeInteger(state.workflow.cursor) && state.workflow.cursor >= 0 && state.workflow.cursor <= dayTasks.length);
    }
    assert(Number.isSafeInteger(state.observeCursor) && state.observeCursor >= 0 && state.observeCursor < familyCount);
    if (state.pending) {
      const pending = state.pending, task = (pending.mode === 'prepare' ? prepTasks : dayTasks)[cursor(pending.mode)];
      assert.equal(pending.cursor, cursor(pending.mode)); assert.deepEqual(pending.task, task);
      assert.equal(pending.selected.characterId, roster[task.index].characterId);
      const component = pending.component === 'family' ? families[task.index].checkpoint().payload.pending
        : pending.component === 'turf' ? turfs.get(task.index).checkpoint().payload.pending : null;
      if (component) assert.deepEqual(component, pending.selected);
      else assert.equal(pending.component, null);
    }
    for (const [index, policy] of turfs) {
      const active = state.active[index]; assert(active && active.day >= 0 && active.day < state.rounds.length);
      assert.equal(policy.checkpoint().payload.configuration.seed, turfConfig(index, active.day).seed);
    }
  };
  const checkHooks = hooks => {
    assert(Number.isSafeInteger(hooks.logicalAt) && hooks.logicalAt >= epoch);
    for (const key of ['read', 'execute', 'record']) assert.equal(typeof hooks[key], 'function');
    assert(!state.failure, state.failure || ''); assert.equal(state.unresolved.length, 0, 'Unknown completed war replay');
  };
  const limitOf = ({ maximumDecisions = 64 } = {}) => {
    assert(Number.isSafeInteger(maximumDecisions) && maximumDecisions > 0 && maximumDecisions <= 10000); return maximumDecisions;
  };
  async function ownView(index, hooks) {
    const accountId = roster[index].accountId, get = path => hooks.read(accountId, path);
    const session = await get('/v1/session'), me = await get('/v1/me');
    assert(session.authed && session.character?.id === roster[index].characterId && me.character?.id === roster[index].characterId,
      'War actor generation changed; explicit transition required');
    return { accountId, session, me };
  }
  const command = (mode, task, logicalAt, type, path, body, expected = null) => ({ kind: 'command', type,
    characterId: roster[task.index].characterId, logicalAt, expected,
    request: { method: 'POST', path, body, idempotencyKey: 'rc1-war-' + hash([configurationHash, mode, state.nextDay, cursor(mode), task, body]) } });
  async function select(mode, task, hooks) {
    const { index, phase } = task, view = await ownView(index, hooks), own = view.me.character;
    const wait = reason => ({ selected: { kind: 'wait', reason }, view, component: null });
    if (phase === 'entry') {
      assert.equal(own.level, index < familyCount ? plan.founderLevel : 1); assert.equal(own.cash, 500); assert.equal(own.ammo, 25);
      for (const key of ['bank', 'cb', 'omr']) assert.equal(own[key], 0, 'Nonordinary entry ' + key);
      assert.equal(own.gang, null); assert.equal(own.checkin.done, false); return wait('entry-verified');
    }
    if (phase === 'membership' || mode === 'day') assert.equal(own.gang?.id, state.familyIds[index % familyCount], 'Assigned Family changed');
    if (phase === 'membership') return wait('membership-verified');
    if (phase === 'holder' || phase === 'seize' || phase === 'claim') view.districts = await hooks.read(view.accountId, '/v1/districts');
    const district = view.districts?.districts?.find(row => row.id === districtId);
    if (phase === 'holder') { assert.equal(district?.holder?.gangId, state.familyIds[0]); return wait('initial-holder-verified'); }
    if (phase === 'claim') {
      const old = turfs.get(index); assert(!old || !old.summary().commitment || old.summary().outcome, 'Prior commitment still unsettled');
      const policy = createTurfPolicy(turfConfig(index, state.nextDay)); turfs.set(index, policy);
      state.active[index] = { day: state.nextDay, logicalAt: hooks.logicalAt, observation: null };
      view.notifications = { notifications: [] };
      return { selected: policy.choose(view, { districtId, logicalAt: hooks.logicalAt }), view, component: 'turf' };
    }
    view.rules = await hooks.read(view.accountId, '/v1/rules');
    if (mode === 'prepare') assert.equal(view.rules.family.foundCost, 25000, 'Retained formation quote changed');
    if (phase === 'checkin') {
      assert.equal(typeof own.checkin?.done, 'boolean');
      if (own.checkin.done) { assert.equal(mode, 'day', 'Required initial check-in unavailable'); return wait('already-checked-in'); }
      assert(Number.isSafeInteger(own.checkin.pay) && own.checkin.pay > 0);
      if (mode === 'prepare') assert.equal(own.checkin.pay, 140000);
      return { selected: command(mode, task, hooks.logicalAt, 'war.checkin', '/v1/checkin', {}, { pay: own.checkin.pay }), view, component: null };
    }
    if (phase === 'fund') {
      assert.equal(own.gang?.id, state.familyIds[index]); assert(own.cash >= 100000 && view.rules.family.tributeMin <= 100000);
      return { selected: command(mode, task, hooks.logicalAt, 'war.fund', '/v1/gangs/tribute', { amount: 100000 }), view, component: null };
    }
    if (phase === 'seize') {
      assert(district && !district.holder && !district.occupiedBy && !district.contest, 'Initial district is not vacant');
      assert.equal(own.gang?.id, state.familyIds[0]); assert.equal(own.gang.role, 'boss');
      return { selected: command(mode, task, hooks.logicalAt, 'war.seize', '/v1/districts/' + districtId + '/seize', {}), view, component: null };
    }
    view.directory = await hooks.read(view.accountId, '/v1/gangs');
    const selected = families[index].choose(view, { phase, logicalAt: hooks.logicalAt,
      targetFamilyId: phase === 'enter' ? state.familyIds[index % familyCount] : null });
    if (mode === 'prepare') assert.equal(selected.kind, 'command', 'Required preparation choice unavailable');
    return { selected, view, component: 'family' };
  }
  function settle(pending, response) {
    assert([200, 400].includes(response.status)); assert.equal(typeof response.replayed, 'boolean');
    const status = response.status === 200 ? 'COMPLETED' : 'DENIED', { selected, task, component } = pending;
    if (status === 'COMPLETED' && !response.replayed && component === null) {
      assert.equal(response.body.ok, true);
      if (task.phase === 'checkin') assert.equal(response.body.pay, selected.expected.pay);
      if (task.phase === 'fund') { assert.equal(response.body.amount, 100000); assert.equal(response.body.currency, 'cash'); }
      if (task.phase === 'seize') {
        assert.equal(response.body.district, districtId); assert(Number.isSafeInteger(response.body.cost) && response.body.cost > 0);
        assert(Number.isSafeInteger(response.body.garrison) && response.body.garrison > 0);
      }
    }
    if (status === 'DENIED') assert.equal(typeof response.body.error, 'string');
    if (component) (component === 'family' ? families[task.index] : turfs.get(task.index)).settle({
      idempotencyKey: selected.request.idempotencyKey, status, replayed: response.replayed, response: response.body });
    if (status === 'COMPLETED' && response.replayed) state.unresolved.push({ pending: clone(pending), response: clone(response) });
    else if (status === 'COMPLETED') {
      state.fresh++; const type = selected.type || 'war.claim'; state.completedByType[type] = (state.completedByType[type] || 0) + 1;
      if (task.phase === 'found') state.familyIds[task.index] = response.body.gangId;
      if (task.phase === 'claim') state.rounds[state.nextDay].claims.push({ founder: task.index, familyId: selected.familyId,
        staked: response.body.staked, deadline: hooksDeadline(selected, response.body) });
    } else { state.denied++; if (pending.mode === 'prepare') state.failure = 'Required canonical preparation denied: ' + task.phase; }
  }
  const hooksDeadline = (selected, body) => selected.logicalAt + body.resolvesSeconds * 1000;
  async function run(mode, hooks, options) {
    const maximum = limitOf(options), tasks = mode === 'prepare' ? prepTasks : dayTasks;
    for (let step = 0; step < maximum && cursor(mode) < tasks.length; step++) {
      const task = tasks[cursor(mode)], accountId = roster[task.index].accountId;
      if (!state.pending) {
        const { selected, view, component } = await select(mode, task, hooks);
        await hooks.record({ kind: 'war-choice', mode, day: state.nextDay, cursor: cursor(mode), accountId, phase: task.phase,
          logicalAt: hooks.logicalAt, viewSha256: hash(view), selected: clone(selected) });
        if (selected.kind === 'wait') { state.waits++; advance(mode); continue; }
        state.pending = { mode, cursor: cursor(mode), task, selected, component };
      }
      // Re-record on retry: failure while persisting this event must never dispatch an unretained request.
      await hooks.record({ kind: 'war-pending', logicalAt: hooks.logicalAt, pending: clone(state.pending) });
      const response = await hooks.execute(accountId, state.pending.selected.request);
      await hooks.record({ kind: 'war-response', accountId, key: state.pending.selected.request.idempotencyKey, response: clone(response) });
      settle(state.pending, response); state.pending = null; advance(mode);
      assert(!state.failure, state.failure || ''); assert.equal(state.unresolved.length, 0, 'Unknown completed war replay');
    }
    const complete = cursor(mode) === tasks.length;
    if (complete) {
      if (mode === 'prepare') state.prepared = true;
      else { state.nextDay++; state.workflow = null; }
      await hooks.record({ kind: 'war-' + mode + '-complete', logicalAt: hooks.logicalAt, nextDay: state.nextDay });
    }
    return { complete, ...api.summary() };
  }
  const api = {
    checkpoint() {
      validate(); const payload = { version: 1, configuration, state: clone(state), families: families.map(policy => policy.checkpoint()),
        turfs: [...turfs].map(([index, policy]) => ({ index, checkpoint: policy.checkpoint() })) };
      return { payload, sha256: hash(payload) };
    },
    restore(checkpoint) {
      assert.equal(hash(checkpoint.payload), checkpoint.sha256, 'War checkpoint checksum mismatch');
      assert.equal(checkpoint.payload.version, 1); assert.deepEqual(checkpoint.payload.configuration, configuration);
      state = clone(checkpoint.payload.state); assert.equal(checkpoint.payload.families.length, roster.length);
      families = roster.map((_, index) => createFamilyPolicy(familyConfig(index)).restore(checkpoint.payload.families[index]));
      turfs = new Map(checkpoint.payload.turfs.map(({ index, checkpoint: saved }) => {
        assert(Number.isSafeInteger(index) && index >= 0 && index < familyCount);
        return [index, createTurfPolicy(turfConfig(index, state.active[index].day)).restore(saved)];
      })); validate(); return api;
    },
    summary() {
      validate(); return { prepared: state.prepared, nextDay: state.nextDay,
        observedLogicalDays: Math.max(0, state.nextDay - 1), population: roster.length, plannedFamilies: familyCount,
        formedFamilies: Object.keys(state.familyIds).length, fresh: state.fresh, denied: state.denied, waits: state.waits,
        completedByType: clone(state.completedByType), pending: !!state.pending, dayInProgress: !!state.workflow, unresolvedResponses: state.unresolved.length,
        awaitingSettlements: activeCommitments(), failure: state.failure, rounds: clone(state.rounds), matrixQualifying: false };
    },
    async prepare(hooks, options) {
      checkHooks(hooks); assert.equal(hooks.logicalAt, epoch, 'Preparation clock changed');
      if (state.prepared) return { complete: true, ...api.summary() };
      return run('prepare', hooks, options);
    },
    async runDay(day, hooks, options) {
      checkHooks(hooks); assert(state.prepared); assert.equal(day, state.nextDay);
      assert.equal(hooks.logicalAt, epoch + day * DAY, 'War day skipped or clock changed');
      if (!state.workflow) {
        if (activeCommitments()) return { complete: false, waitingForSettlement: true, ...api.summary() };
        state.workflow = { day, cursor: 0 }; state.rounds.push({ day, logicalAt: hooks.logicalAt, claims: [], outcomes: [] });
      }
      return run('day', hooks, options);
    },
    async observeSettlements(hooks, options) {
      checkHooks(hooks); assert(state.prepared && !state.workflow && !state.pending, 'Finish the bounded daily workflow before observation');
      const maximum = limitOf(options);
      for (let step = 0; step < maximum; step++) {
        const index = state.observeCursor, policy = turfs.get(index), active = state.active[index];
        if (policy?.summary().commitment && !policy.summary().outcome) {
          assert(hooks.logicalAt >= active.logicalAt);
          if (!active.observation) {
            const view = await ownView(index, hooks); view.districts = await hooks.read(view.accountId, '/v1/districts');
            view.notifications = await hooks.read(view.accountId, '/v1/notifications');
            active.observation = { logicalAt: hooks.logicalAt, view };
          }
          // Persist delivery before using it; retained observation survives a record/processing exception.
          await hooks.record({ kind: 'war-settlement-observation', founder: index, day: active.day, observation: clone(active.observation) });
          const view = clone(active.observation.view);
          view.notifications.notifications = view.notifications.notifications.filter(notification => {
            const at = new Date(notification.at).getTime(); assert(Number.isSafeInteger(at), 'Unbound notification time');
            return at >= active.logicalAt;
          });
          const candidate = createTurfPolicy(turfConfig(index, active.day)).restore(policy.checkpoint());
          const selected = candidate.choose(view, { districtId, logicalAt: active.observation.logicalAt });
          await hooks.record({ kind: 'war-settlement-choice', founder: index, day: active.day, selected });
          turfs.set(index, candidate);
          if (selected.kind === 'outcome') state.rounds[active.day].outcomes.push({ founder: index, ...selected });
          else assert.equal(selected.kind, 'wait');
          active.observation = null;
        }
        state.observeCursor = (index + 1) % familyCount;
        if (!state.observeCursor) return { complete: true, ...api.summary() };
      }
      return { complete: false, ...api.summary() };
    },
  };
  return api;
}
