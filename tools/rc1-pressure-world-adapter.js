// Public-view resource pressure. The runner owns initialization and original workers.
import assert from 'node:assert/strict';
import { createResourcePressurePolicy, planResourcePressure } from './rc1-resource-pressure-policy.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

const DAY = 86400000, clone = structuredClone;
const ROLES = ['seller', 'taker', 'hoarder'];
const PREPARATION = ['entry', 'checkin', 'replenish-ammo', 'replenish-ammo', 'replenish-ammo', 'prepared'];
const DAILY = [ ['checkin', null], ['progress', null], ['replenish-ammo', null],
  ['list', 'seller'], ['take', 'taker'], ['hoard', 'hoarder'], ['cancel', 'seller'] ];
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
const receiptBody = ({ replayed: _flag, ...body }) => body;
export const PRESSURE_WORLD_CONTRACT = Object.freeze({ version: 2, populations: [25, 100, 250, 500, 1000],
  scarcity: 'After ordinary entry, the caller completes canonical prebaseline depletion: five admitted standard jumps consume birth25 ammo, public megaproject donations consume whole cash, and a public check-in tops up a below-minimum remainder when needed. Every recovery advances all due original workers. Prepare verifies generation1 and public cash0/bank0/ammo0; caller separately verifies exact native zero balances, retained custody and original invariants. Earned progression, health/energy changes and used check-ins remain real preparation effects. This is the exercised player cash/ammo floor, not a thirteen-resource or global/NPC minimum.',
  abundance: 'Same ordinary resources with only the declared initialization level75 respect fixture; before the measured baseline each actor takes the public first check-in26250 and three canonical2000-for50 ammo purchases. Prepared cash20750/ammo175, with no direct cash/ammo grants.',
  sources: ['schema.sql:characters ordinary-entry defaults', 'src/game.js:checkinQuoteOf/checkin', 'src/economy.js:buyAmmo', 'src/social/exchange.js:listExchange/buyExchange', 'tools/rc1-resource-pressure-policy.js', 'tools/rc1-scarcity-initialization.js'],
  daily: 'All actors attempt public daily check-in, one quiet progression action and an affordable paid ammo purchase. Seller/taker/hoarder roles rotate by (roster index + day) modulo3. Sellers list25 rounds at20, takers choose the cheapest affordable public lot, hoarders bank pocket cash, sellers cancel any remaining receipt-linked lot. Actual shortages/denials remain evidence.',
  authority: 'Ordinary own session/me plus public rules/exchange only. Preparation and actor reads may accrue. Hidden resource/concentration observers never feed selection; capture them separately at existing boundaries.',
  evidence: 'Finish prepare and retain its canonical receipts before capturing the measured baseline. Pin initialization-only respect fixture/defaults in the runner. Await compact exact pending records before dispatch; full checkpoints at serial/fault boundaries and event replay between them.',
  scope: 'Existing cash/ammo exchange, canonical replenishment, bank hoarding and sinks. No invented global maximum, all-resource-extreme requirement, concurrent-market proof or matrix clearance. Original workers, resource equations, concentration and duration remain runner observations.' });

export function createPressureWorldAdapter(input) {
  assert(Object.keys(input).every((key) => ['scenario', 'seed', 'roster', 'epoch'].includes(key)), 'Unapproved pressure configuration');
  const { scenario, seed, epoch } = input, plan = planResourcePressure(scenario);
  assert(typeof seed === 'string' && seed.length > 0); assert(Number.isSafeInteger(epoch) && epoch >= 0);
  assert(Array.isArray(input.roster) && PRESSURE_WORLD_CONTRACT.populations.includes(input.roster.length));
  assert(input.roster.every((actor) => identifier(actor.accountId) && identifier(actor.characterId)));
  const roster = input.roster.map(({ accountId, characterId }) => ({ accountId, characterId }));
  assert.equal(new Set(roster.map((actor) => actor.accountId)).size, roster.length);
  assert.equal(new Set(roster.map((actor) => actor.characterId)).size, roster.length);
  const configuration = { scenario, seed, epoch, roster }, byAccount = new Map(roster.map((actor) => [actor.accountId, actor]));
  let policies = new Map(roster.map(({ accountId }) => [accountId, createResourcePressurePolicy({ accountId, scenario, seed })]));
  const totals = () => ({ fresh: 0, waits: 0, denied: 0 });
  const stateVersion = scenario === 'resource_scarcity' ? 2 : 1;
  let state = { version: stateVersion, configuration: clone(configuration), prepared: false, preparationFailure: null,
    preparation: { index: 0, stage: 0 }, completedDays: 0, day: null, pending: null, unresolved: [], exactReplays: 0,
    entryVerified: 0, preparedVerified: 0, totals: { preparation: totals(), measured: totals() },
    lastReceipts: {} };
  const role = (index, day) => ROLES[(index + day) % ROLES.length];
  function current() {
    if (!state.prepared) return { scope: 'preparation', index: state.preparation.index,
      phase: PREPARATION[state.preparation.stage], logicalAt: epoch };
    assert(state.day, 'Begin a measured day first');
    return { scope: 'measured', index: state.day.index, phase: DAILY[state.day.stage][0], logicalAt: epoch + state.day.day * DAY };
  }
  function advance() {
    if (!state.prepared) {
      if (scenario === 'resource_scarcity' || ++state.preparation.stage === PREPARATION.length) {
        state.preparation.index++; state.preparation.stage = 0;
      }
      if (state.preparation.index === roster.length) { state.prepared = true; state.preparation = null; }
      return;
    }
    do {
      state.day.index++;
      if (state.day.index === roster.length) { state.day.index = 0; state.day.stage++; }
      if (state.day.stage === DAILY.length) { state.completedDays++; state.day = null; return; }
    } while (DAILY[state.day.stage][1] && role(state.day.index, state.day.day) !== DAILY[state.day.stage][1]);
  }
  function validate(value, components = policies) {
    assert.equal(value.version, stateVersion, 'Preparation checkpoint uses an earlier initial-supply contract'); assert.deepEqual(value.configuration, configuration);
    assert(Number.isSafeInteger(value.completedDays) && value.completedDays >= 0);
    for (const count of [value.entryVerified, value.preparedVerified]) assert(Number.isSafeInteger(count) && count >= 0 && count <= roster.length);
    if (value.prepared) { assert.equal(value.preparation, null); assert.equal(value.entryVerified, roster.length);
      assert.equal(value.preparedVerified, roster.length); }
    else { assert(value.preparation && Number.isSafeInteger(value.preparation.index) && value.preparation.index >= 0 && value.preparation.index < roster.length);
      assert(Number.isSafeInteger(value.preparation.stage) && value.preparation.stage >= 0 && value.preparation.stage < PREPARATION.length);
      assert.equal(value.entryVerified, value.preparation.index + Number(value.preparation.stage > 0));
      assert.equal(value.preparedVerified, value.preparation.index); }
    if (value.day) { assert(value.prepared && value.day.day === value.completedDays);
      assert(Number.isSafeInteger(value.day.stage) && value.day.stage >= 0 && value.day.stage < DAILY.length);
      assert(Number.isSafeInteger(value.day.index) && value.day.index >= 0 && value.day.index < roster.length); }
    for (const total of Object.values(value.totals)) for (const count of Object.values(total)) assert(Number.isSafeInteger(count) && count >= 0);
    let fresh = 0, waits = 0, denied = 0, unknown = 0;
    for (const actor of roster) {
      const component = components.get(actor.accountId).checkpoint().payload;
      assert(component.characterId === null || component.characterId === actor.characterId, 'Foreign component character');
      fresh += component.counters.fresh; waits += component.counters.waits; denied += component.counters.denied; unknown += component.counters.unresolvedReplays;
      if (component.pending) {
        assert.equal(value.pending?.accountId, actor.accountId, 'Component/adapter pending actor mismatch');
        assert.deepEqual(value.pending.decision, component.pending, 'Component/adapter pending request mismatch');
      }
    }
    for (const [key, count] of Object.entries({ fresh, waits, denied })) assert.equal(count, value.totals.preparation[key] + value.totals.measured[key]);
    assert.equal(unknown, value.unresolved.length);
    if (value.pending) {
      const cursor = value.prepared ? value.day : value.preparation;
      assert(cursor && roster[cursor.index].accountId === value.pending.accountId);
      assert.equal(value.pending.scope, value.prepared ? 'measured' : 'preparation');
      assert.equal(value.pending.decision.phase, value.prepared ? DAILY[cursor.stage][0] : PREPARATION[cursor.stage], 'Pending phase/cursor mismatch');
      assert.equal(value.pending.decision.logicalAt, value.prepared ? epoch + cursor.day * DAY : epoch, 'Pending clock/cursor mismatch');
      assert(['SELECTED', 'DISPATCHING'].includes(value.pending.dispatchState));
      assert.deepEqual(components.get(value.pending.accountId).checkpoint().payload.pending, value.pending.decision);
    }
  }
  async function readView(accountId, read) {
    const view = { accountId, session: await read(accountId, '/v1/session'), me: await read(accountId, '/v1/me'),
      rules: await read(accountId, '/v1/rules'), exchange: await read(accountId, '/v1/exchange') };
    const actor = byAccount.get(accountId);
    assert.equal(view.session?.authed, true); assert.equal(view.session.character?.id, actor.characterId);
    assert.equal(view.me?.character?.id, actor.characterId, 'Replacement requires an explicit new actor cursor');
    return view;
  }
  async function run(scope, hooks, { maximumDecisions = 64, pauseBeforeDispatch = false } = {}) {
    const { read, execute, record, logicalAt } = hooks;
    for (const fn of [read, execute, record]) assert.equal(typeof fn, 'function');
    assert(Number.isSafeInteger(maximumDecisions) && maximumDecisions >= 1 && maximumDecisions <= 4096);
    assert.equal(state.unresolved.length, 0, 'Unresolved completed replay');
    assert.equal(state.preparationFailure, null, 'Failed preparation cannot become a measured baseline');
    for (let count = 0; count < maximumDecisions && (scope === 'preparation' ? !state.prepared : state.day !== null); count++) {
      const step = current(), actor = roster[step.index]; assert.equal(step.scope, scope); assert.equal(logicalAt, step.logicalAt, 'Use the original declared day clock');
      let decision;
      if (state.pending) decision = clone(state.pending.decision);
      else {
        const view = await readView(actor.accountId, read), own = view.me.character;
        if (scope === 'preparation' && ['entry', 'prepared'].includes(step.phase)) {
          const entry = step.phase === 'entry';
          const scarcity = scenario === 'resource_scarcity';
          const expected = scarcity ? { cash: 0, bank: 0, ammo: 0, generation: 1 }
            : { cash: entry ? 500 : 20750, ammo: entry ? 25 : 175, bank: 0, cb: 0, omr: 0 };
          for (const [field, value] of Object.entries(expected)) assert.equal(own[field], value, `Preparation ${step.phase} ${field}`);
          if (!scarcity) {
            assert.equal(own.level, 75, 'Declared initial progression level');
            if (entry) { assert.equal(own.checkin?.done, false); assert.equal(own.checkin?.pay, plan.canonicalFirstCheckin); }
            else assert.equal(own.checkin?.done, true, 'Prepared first check-in must be canonical');
          }
          await record({ kind: 'pressure-initial-supply', accountId: actor.accountId, logicalAt, phase: step.phase,
            expected, observed: Object.fromEntries(Object.keys(expected).map((key) => [key, own[key]])), level: own.level,
            publicCheckin: clone(own.checkin), authorizedViewSha256: actorValueHash(view),
            remainingDefaults: scarcity
              ? 'Canonical preparation progression/health/check-in effects and exact native balances/custody are retained by the runner; public rounded zeros alone do not attest the exact baseline'
              : 'Original schema/entry defaults are attested by the runner baseline, never inferred from omitted public fields' });
          if (entry) state.entryVerified++;
          if (!entry || scenario === 'resource_scarcity') state.preparedVerified++;
          advance(); continue;
        }
        decision = policies.get(actor.accountId).choose(view, { logicalAt, phase: step.phase });
        await record({ kind: 'pressure-decision', scope, accountId: actor.accountId, logicalAt,
          day: state.day?.day ?? null, role: state.day ? role(step.index, state.day.day) : null,
          authorizedViewSha256: actorValueHash(view), decision });
        if (decision.kind === 'wait') {
          state.totals[scope].waits++;
          if (scope === 'preparation') { state.preparationFailure = { accountId: actor.accountId, decision }; throw Error('Canonical preparation unexpectedly waited'); }
          advance(); continue;
        }
        state.pending = { accountId: actor.accountId, scope, decision: clone(decision),
          authorizedViewSha256: actorValueHash(view), expectedCheckinPay: step.phase === 'checkin' ? own.checkin.pay : null, dispatchState: 'SELECTED' };
      }
      await record({ kind: 'pressure-pending', logicalAt, cursor: scope === 'preparation' ? clone(state.preparation) : clone(state.day), ...clone(state.pending) });
      if (pauseBeforeDispatch) return { complete: false, paused: true, cursor: api.cursor() };
      state.pending.dispatchState = 'DISPATCHING';
      const response = await execute(actor.accountId, clone(decision.request)), outcome = api.settle(response);
      await record({ kind: 'pressure-settlement', scope, accountId: actor.accountId, logicalAt, request: clone(decision.request), response: clone(response), outcome });
      if (outcome.blocked) return { complete: false, blocked: true, cursor: api.cursor() };
      if (state.preparationFailure) throw Error('Canonical preparation was denied');
    }
    return { complete: scope === 'preparation' ? state.prepared : state.day === null, cursor: api.cursor() };
  }
  const api = {
    cursor() { return { prepared: state.prepared, preparation: clone(state.preparation), completedDays: state.completedDays,
      day: clone(state.day), nextDayAt: epoch + state.completedDays * DAY, pending: clone(state.pending) }; },
    prepare(hooks, options) { assert.equal(hooks.logicalAt, epoch); return run('preparation', hooks, options); },
    runDay(day, hooks, options) {
      assert(state.prepared, 'Complete canonical preparation before the measured baseline');
      assert(Number.isSafeInteger(day) && day === state.completedDays, 'Run every declared day consecutively');
      assert.equal(hooks.logicalAt, epoch + day * DAY, 'Advance every original worker to the daily boundary');
      state.day ||= { day, stage: 0, index: 0 }; return run('measured', hooks, options);
    },
    settle(response) {
      assert(state.pending, 'No pending pressure action');
      assert(response.status === 200 || Number.isSafeInteger(response.status) && response.status >= 400 && response.status < 500,
        'Unexpected response retains the pending identity');
      assert.equal(typeof response.replayed, 'boolean');
      const pending = state.pending, body = receiptBody(response.body), { accountId, scope, decision } = pending;
      if (body.character) assert.equal(body.character.id, byAccount.get(accountId).characterId, 'Foreign response character');
      if (response.status === 200 && !response.replayed && decision.phase === 'checkin')
        assert.equal(body.pay, pending.expectedCheckinPay, 'Canonical check-in must match the observed public quote');
      policies.get(accountId).settle({ idempotencyKey: decision.request.idempotencyKey,
        status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: response.replayed, response: body });
      state.pending = null;
      if (response.status === 200 && response.replayed) {
        state.unresolved.push({ ...clone(pending), response: clone(response) }); return { blocked: true, reason: 'unresolved-replay' };
      }
      state.totals[scope][response.status === 200 ? 'fresh' : 'denied']++;
      state.lastReceipts[accountId] = { decision: clone(decision), status: response.status, responseSha256: actorValueHash(body) };
      if (scope === 'preparation' && response.status !== 200) state.preparationFailure = { accountId, decision, response: clone(response) };
      else advance();
      return { blocked: false, scope, status: response.status };
    },
    settleExactReplay(accountId, decision, response) {
      assert(!state.pending); const known = state.lastReceipts[accountId];
      assert(known && response.replayed && known.status === response.status);
      assert.deepEqual(known.decision, decision, 'Replay request changed');
      const body = receiptBody(response.body); assert.equal(actorValueHash(body), known.responseSha256, 'Replay receipt changed');
      policies.get(accountId).settle({ idempotencyKey: decision.request.idempotencyKey,
        status: response.status === 200 ? 'COMPLETED' : 'DENIED', replayed: true, response: body }); state.exactReplays++;
    },
    checkpoint() { validate(state); const payload = { state: clone(state), policies: Object.fromEntries([...policies].map(([id, policy]) => [id, policy.checkpoint()])) };
      return { payload, sha256: actorValueHash(payload) }; },
    restore(checkpoint) {
      assert.equal(checkpoint.sha256, actorValueHash(checkpoint.payload), 'Pressure checkpoint checksum mismatch');
      assert.deepEqual(Object.keys(checkpoint.payload.policies).sort(), roster.map((actor) => actor.accountId).sort());
      const restored = new Map(roster.map(({ accountId }) => [accountId, createResourcePressurePolicy({ accountId, scenario, seed }).restore(checkpoint.payload.policies[accountId])]));
      validate(checkpoint.payload.state, restored); state = clone(checkpoint.payload.state); policies = restored; return api;
    },
    summary() { return { scenario, population: roster.length, prepared: state.prepared, entryVerified: state.entryVerified,
      preparedVerified: state.preparedVerified, completedDays: state.completedDays,
      observedLogicalDays: Math.max(0, state.completedDays - 1), nextDayAt: epoch + state.completedDays * DAY,
      totals: clone(state.totals), pending: !!state.pending, preparationFailed: !!state.preparationFailure,
      unresolvedResponses: state.unresolved.length, exactReplays: state.exactReplays,
      policies: Object.fromEntries([...policies].map(([id, policy]) => [id, policy.summary()])),
      roleSchedule: '(roster index + day) modulo3: seller, taker, hoarder',
      observerMetrics: 'Concentration, complete balances, sinks and ledger attribution require separate canonical observer evidence', matrixQualifying: false }; },
  };
  return api;
}
