// Roster scheduling only. Canonical accounts, possessions and commitments outlive sessions.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const copy = (value) => structuredClone(value);
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const WEEK_MS = 7 * 86400000;
const identity = (value) => typeof value === 'string' && value.length > 0;
const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), keys.sort());
export const CHURN_POLICY_CONTRACT = Object.freeze({ version: 1, scenarioId: 'high_player_churn',
  denominator: 'Caller supplies the recorded actual active account IDs for the completed week, all members of the current cohort. Merely registered or retired accounts never enter this denominator.',
  quota: 'Replace floor((3 * activeCount + carriedTenths) / 10), carrying the remainder modulo 10. Twenty-five active actors replace 7 then 8; cumulative replacements equal floor(0.30 * cumulative weekly active counts). No exact 30% claim for an indivisible week.',
  retirement: 'Stop selecting retired sessions immediately at the quiescent weekly boundary. Never ban, kill, delete, transfer, cancel or rewrite their canonical accounts, assets, commitments or deadlines.',
  entry: 'Ordinary POST /v1/auth/guest with a caller-persisted random bootstrapSecret, then authenticated POST /v1/character. Persist the returned bearer before character creation retires bootstrap recovery. Pending identities and exact character idempotency keys survive restart.',
  custody: 'Retired identities remain in lifetime resource/observer snapshots. The runner executes canonical workers against the whole world, not just the current cohort.',
  credentials: 'The component stores opaque credential/session references only. The caller persists actual secrets and bearers privately before the next request. Never derive real bootstrap secrets from a public seed.',
  settlement: 'Only verified canonical completed identities may settle enrollment. Exact repeated settlements are no-ops. Unknown outcomes retain the pending request; denials never enroll an actor. A replayed character response may reconcile its already committed identity.',
  exclusions: 'This component does not establish seven days of activity, all gameplay authorities, original worker expiry/recovery, 90-day or matrix qualification.' });

export function createChurnPolicy(configuration) {
  exactKeys(configuration, ['seed', 'epochAt', 'initialRoster']);
  assert(identity(configuration.seed)); assert(Number.isSafeInteger(configuration.epochAt) && configuration.epochAt >= 0);
  assert(Array.isArray(configuration.initialRoster) && configuration.initialRoster.length > 0);
  for (const actor of configuration.initialRoster) {
    exactKeys(actor, ['accountId', 'characterId', 'sessionRef']);
    assert(Object.values(actor).every(identity));
  }
  for (const key of ['accountId', 'characterId', 'sessionRef'])
    assert.equal(new Set(configuration.initialRoster.map((actor) => actor[key])).size, configuration.initialRoster.length, `Duplicate initial ${key}`);
  configuration = copy(configuration);
  let state = { version: 1, configuration, current: configuration.initialRoster.map((actor) => actor.accountId).sort(),
    lifetime: configuration.initialRoster.map((actor) => ({ ...actor, joinedWeek: 0, retiredWeek: null })),
    retired: [], weeks: [], enrollments: [], receipts: [], remainderTenths: 0 };

  function weekPlan({ week, activeAccountIds, logicalAt }) {
    assert(Number.isSafeInteger(week) && week === state.weeks.length + 1, 'Weeks must be consecutive');
    assert(Number.isSafeInteger(logicalAt) && logicalAt >= configuration.epochAt + week * WEEK_MS, 'Weekly boundary is not due');
    assert(logicalAt >= (state.weeks.at(-1)?.logicalAt ?? configuration.epochAt), 'Boundary time moved backwards');
    assert(!state.enrollments.some((entry) => entry.phase !== 'complete'), 'Previous enrollment is pending');
    assert(Array.isArray(activeAccountIds)); assert.equal(new Set(activeAccountIds).size, activeAccountIds.length, 'Duplicate active identity');
    assert(activeAccountIds.every((id) => identity(id) && state.current.includes(id)), 'Active denominator contains noncurrent identity');
    const active = [...activeAccountIds].sort(), numerator = active.length * 3 + state.remainderTenths;
    const count = Math.floor(numerator / 10);
    assert(count <= active.length, 'Replacement quota exceeds active population');
    const ranked = [...active].sort((a, b) => {
      const ah = digest([configuration.seed, week, a]), bh = digest([configuration.seed, week, b]);
      return ah < bh ? -1 : ah > bh ? 1 : a.localeCompare(b);
    });
    return { week, logicalAt, activeAccountIds: active, retiredAccountIds: ranked.slice(0, count),
      replacementCount: count, remainderBefore: state.remainderTenths, remainderAfter: numerator % 10 };
  }
  const api = {
    previewWeek(input) { return copy(weekPlan(input)); },
    beginWeek(input) {
      const plan = weekPlan(input);
      state.weeks.push(plan); state.remainderTenths = plan.remainderAfter;
      for (const [slot, accountId] of plan.retiredAccountIds.entries()) {
        const actor = state.lifetime.find((entry) => entry.accountId === accountId);
        actor.retiredWeek = plan.week; state.retired.push(accountId);
        state.current = state.current.filter((id) => id !== accountId);
        const requestId = digest(['churn-enrollment-v1', configuration.seed, plan.week, slot, accountId]);
        state.enrollments.push({ requestId, week: plan.week, replacesAccountId: accountId,
          credentialRef: `guest-${requestId}`, name: `Churn ${requestId.slice(0, 18)}`, phase: 'guest',
          accountId: null, characterId: null, sessionRef: null });
      }
      return copy(plan);
    },
    nextEnrollment() {
      const pending = state.enrollments.find((entry) => entry.phase !== 'complete');
      if (!pending) return null;
      const { requestId, phase, credentialRef, accountId, sessionRef, name } = pending;
      if (phase === 'guest') return { requestId, phase, credentialRef,
        request: { method: 'POST', path: '/v1/auth/guest', requiredSecretField: 'bootstrapSecret' } };
      return { requestId, phase, accountId, sessionRef,
        request: { method: 'POST', path: '/v1/character', body: { name }, idempotencyKey: `churn-character-${requestId}` } };
    },
    settleEnrollment(receipt) {
      assert(receipt && ['guest', 'character'].includes(receipt.phase));
      const previous = state.receipts.find((entry) => entry.requestId === receipt.requestId && entry.phase === receipt.phase);
      if (previous) { assert.deepEqual(receipt, previous, 'Conflicting enrollment receipt'); return { duplicate: true }; }
      const pending = api.nextEnrollment();
      assert(pending && pending.requestId === receipt.requestId && pending.phase === receipt.phase, 'Unexpected enrollment identity or phase');
      assert.equal(receipt.status, 'COMPLETED', 'Only completed canonical identities settle enrollment');
      assert(identity(receipt.accountId));
      const enrollment = state.enrollments.find((entry) => entry.requestId === receipt.requestId);
      if (receipt.phase === 'guest') {
        exactKeys(receipt, ['requestId', 'phase', 'status', 'accountId', 'sessionRef']);
        assert(identity(receipt.sessionRef));
        assert(!state.lifetime.some((actor) => actor.accountId === receipt.accountId), 'Account is not a new entrant');
        assert(!state.lifetime.some((actor) => actor.sessionRef === receipt.sessionRef), 'Session reference reused');
        Object.assign(enrollment, { accountId: receipt.accountId, sessionRef: receipt.sessionRef, phase: 'character' });
        state.lifetime.push({ accountId: receipt.accountId, characterId: null, sessionRef: receipt.sessionRef,
          joinedWeek: enrollment.week, retiredWeek: null });
      } else {
        exactKeys(receipt, ['requestId', 'phase', 'status', 'accountId', 'characterId', 'idempotencyKey']);
        assert.equal(receipt.accountId, pending.accountId); assert.equal(receipt.idempotencyKey, pending.request.idempotencyKey);
        assert(identity(receipt.characterId));
        assert(!state.lifetime.some((actor) => actor.characterId === receipt.characterId), 'Character identity reused');
        Object.assign(enrollment, { characterId: receipt.characterId, phase: 'complete' });
        state.lifetime.find((actor) => actor.accountId === receipt.accountId).characterId = receipt.characterId;
        state.current.push(receipt.accountId); state.current.sort();
      }
      state.receipts.push(copy(receipt)); return { duplicate: false };
    },
    isCurrent(accountId) { return state.current.includes(accountId); },
    roster() { return copy({ current: state.current, retired: state.retired, lifetime: state.lifetime }); },
    checkpoint() { return copy(state); },
    restore(checkpoint) {
      // Reconstruct every transition. A forged cohort/count/phase cannot bypass the same guards.
      assert.equal(checkpoint.version, 1); assert.deepEqual(checkpoint.configuration, configuration);
      const reconstructed = createChurnPolicy(configuration);
      for (const week of checkpoint.weeks) {
        reconstructed.beginWeek({ week: week.week, activeAccountIds: week.activeAccountIds, logicalAt: week.logicalAt });
        for (const receipt of checkpoint.receipts.filter((entry) =>
          checkpoint.enrollments.find((enrollment) => enrollment.requestId === entry.requestId)?.week === week.week))
          reconstructed.settleEnrollment(receipt);
      }
      assert.deepEqual(reconstructed.checkpoint(), checkpoint, 'Invalid churn checkpoint');
      state = copy(checkpoint); return api;
    },
    summary() {
      const activeDenominator = state.weeks.reduce((sum, week) => sum + week.activeAccountIds.length, 0);
      const completedEnrollments = state.enrollments.filter((entry) => entry.phase === 'complete').length;
      return { scenarioId: 'high_player_churn', completedWeeklyBoundaries: state.weeks.length,
        cumulativeWeeklyActiveDenominator: activeDenominator, retiredActors: state.retired.length,
        cumulativeReplacementFraction: activeDenominator ? state.retired.length / activeDenominator : null,
        remainderTenths: state.remainderTenths, currentCohort: state.current.length,
        lifetimeRegistered: state.lifetime.length, completedEnrollments,
        pendingEnrollments: state.enrollments.length - completedEnrollments,
        registeredWithoutCharacter: state.lifetime.filter((actor) => actor.characterId === null).length,
        weeklyReplacements: state.weeks.map((week) => week.replacementCount), matrixQualifying: false };
    },
  };
  return api;
}
