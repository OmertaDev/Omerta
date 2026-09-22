// Release actor component. Setup descriptors never write game state; choices use
// only the actor's issued PlayerCommand projection and own public crime inputs.
import assert from 'node:assert/strict';
import { PACING, levelOf } from '../src/rules.js';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { chooseAuthorizedCommand, choosePublicCrime } from './rc1-native-player-policy.js';

const copy = value => structuredClone(value);
const hash = value => sha256(canonicalJson(value));
const id = value => typeof value === 'string' && value.length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const scenarios = ['mostly_new_players', 'mostly_veteran_players'];
const populations = [25, 100, 250, 500, 1000], seeds = ['rc1-alpha', 'rc1-beta', 'rc1-gamma'];
export const COHORT_POLICY_CONTRACT = Object.freeze({ version: 1, veteranLevel: 75,
  rounding: 'ceil(9 * population / 10) majority actors: 23/25 (92%), otherwise exactly 90%. Retain realized counts; never report 22.5 actors or exact90% at population25.',
  mostlyNew: 'Ordinary entry for all actors, no privileged grants. The minority must reach level75 through canonical progression before baseline; an assignment alone never establishes that history.',
  mostlyVeteran: 'Ordinary entry, then the existing initialization-only level75 respect fixture for the veteran majority. Only respect may be directly set; the runner retains before/after provenance and canonical resource checks.',
  baseline: 'New means public level1/respect0. Veteran means public level>=75 with matching levelOf(respect) and declared initialization provenance. The component checks descriptors, not the truth of native history.',
  selection: 'Both cohorts use the same deterministic public selector. Current AVAILABLE unexpired issued commands, own public level/nerve and public crime rules determine choices; initial cohort labels never override current eligibility.',
  continuation: 'Save pending execution identity before dispatch. Unknown outcomes remain pending; an unrecorded completed replay requires native receipt reconciliation before another choice.',
  scope: 'Planning/selection component only. No setup execution, hidden-state policy input, postbaseline fixture mutation, full-world, resource, lifecycle or matrix qualification.' });

export function planCohort(configuration) {
  exactKeys(configuration, ['scenarioId', 'seed', 'roster']);
  const { scenarioId, seed, roster } = configuration;
  assert(scenarios.includes(scenarioId)); assert(seeds.includes(seed));
  assert(Array.isArray(roster) && populations.includes(roster.length));
  assert(roster.every(id)); assert.equal(new Set(roster).size, roster.length, 'Duplicate cohort account');
  const majorityCount = Math.ceil(roster.length * 9 / 10), veteranLevel = COHORT_POLICY_CONTRACT.veteranLevel;
  const veteranRespect = PACING.LEVEL_DIVISOR * (veteranLevel - 1) ** 2;
  assert(Number.isSafeInteger(veteranRespect)); assert.equal(levelOf(veteranRespect), veteranLevel);
  const ranked = [...roster].sort((a, b) => {
    const x = hash(['rc1-cohort-v1', scenarioId, seed, a]), y = hash(['rc1-cohort-v1', scenarioId, seed, b]);
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
  });
  const majority = new Set(ranked.slice(0, majorityCount)), majorityCohort = scenarioId === 'mostly_new_players' ? 'new' : 'veteran';
  const actors = [...roster].sort().map(accountId => {
    const cohort = majority.has(accountId) ? majorityCohort : majorityCohort === 'new' ? 'veteran' : 'new';
    const kind = cohort === 'new' ? 'ordinary-entry' : scenarioId === 'mostly_new_players' ? 'canonical-progression' : 'respect-fixture';
    return { accountId, cohort, initialization: { kind, targetLevel: cohort === 'new' ? 1 : veteranLevel,
      respect: cohort === 'new' ? 0 : veteranRespect,
      directWrites: kind === 'respect-fixture' ? { respect: veteranRespect } : {} } };
  });
  const newActors = actors.filter(a => a.cohort === 'new').length, veteranActors = actors.length - newActors;
  return { version: 1, scenarioId, seed, population: roster.length, majorityCohort,
    counts: { new: newActors, veteran: veteranActors },
    realized: { newActorFraction: newActors / roster.length, veteranActorFraction: veteranActors / roster.length },
    targetMajorityFraction: 0.9, rounding: COHORT_POLICY_CONTRACT.rounding, actors,
    initializationRequired: true, matrixQualifying: false };
}

function validatePlan(plan) {
  assert(plan && Array.isArray(plan.actors));
  assert.deepEqual(plan, planCohort({ scenarioId: plan.scenarioId, seed: plan.seed, roster: plan.actors.map(a => a.accountId) }), 'Cohort plan differs from deterministic assignment');
}

// The runner supplies own-character public projections and references to its
// privately retained entry/progression/fixture evidence. No DB handle is accepted.
export function assessCohortBaseline(plan, observations) {
  validatePlan(plan); assert(Array.isArray(observations));
  const byAccount = new Map();
  for (const observation of observations) {
    exactKeys(observation, ['accountId', 'character', 'provenance']);
    assert(plan.actors.some(a => a.accountId === observation.accountId), 'Foreign cohort observation');
    assert(!byAccount.has(observation.accountId), 'Duplicate cohort observation');
    byAccount.set(observation.accountId, observation);
  }
  const required = [], established = { new: 0, veteran: 0 };
  for (const actor of plan.actors) {
    const observation = byAccount.get(actor.accountId), expected = actor.initialization;
    const missing = reason => required.push({ accountId: actor.accountId, reason, initialization: copy(expected) });
    if (!observation) { missing('missing-public-starting-character'); continue; }
    const { character, provenance } = observation;
    if (!character || !integer(character.respect) || !integer(character.level) || character.level !== levelOf(character.respect)) {
      missing('invalid-public-progression'); continue;
    }
    const validProgression = actor.cohort === 'new' ? character.level === 1 && character.respect === 0
      : expected.kind === 'respect-fixture' ? character.level === expected.targetLevel && character.respect === expected.respect
        : character.level >= expected.targetLevel;
    if (!validProgression) { missing('starting-progression-not-established'); continue; }
    if (!provenance || provenance.kind !== expected.kind || !id(provenance.evidenceRef)) {
      missing('missing-matching-initialization-provenance'); continue;
    }
    established[actor.cohort]++;
  }
  return { ready: required.length === 0, established, required, nativeProvenanceVerified: false,
    statement: 'Public starting classification and evidence-reference completeness only; runner verifies native history and resource invariants.', matrixQualifying: false };
}

const issuedIdentity = command => /^[a-f0-9]{64}$/.test(command?.commandId || '')
  && new RegExp(`^[a-f0-9]{64}\\.${command.commandId}$`).test(command.executionIdentity?.executionId || '')
  && id(command.commandType);

export function createCohortPolicy({ plan, accountId }) {
  validatePlan(plan); const actor = plan.actors.find(a => a.accountId === accountId); assert(actor, 'Unknown cohort actor');
  const configuration = { planSha256: hash(plan), scenarioId: plan.scenarioId, seed: plan.seed, accountId, cohort: actor.cohort };
  let state = { version: 1, configuration, observations: 0, waits: 0, lastDay: null, lastLogicalAt: null, settled: [], pending: null };
  function validate(candidate = state) {
    exactKeys(candidate, ['version', 'configuration', 'observations', 'waits', 'lastDay', 'lastLogicalAt', 'settled', 'pending']);
    assert.equal(candidate.version, 1); assert.deepEqual(candidate.configuration, configuration);
    assert(integer(candidate.observations) && integer(candidate.waits)); assert(Array.isArray(candidate.settled));
    assert.equal(candidate.observations, candidate.waits + candidate.settled.length + Number(!!candidate.pending));
    assert(candidate.lastDay === null || integer(candidate.lastDay)); assert(candidate.lastLogicalAt === null || integer(candidate.lastLogicalAt));
    assert.equal(candidate.lastDay === null, candidate.observations === 0); assert.equal(candidate.lastLogicalAt === null, candidate.observations === 0);
    const seen = new Set();
    for (const receipt of candidate.settled) {
      exactKeys(receipt, ['executionId', 'commandType', 'status', 'replayed']);
      assert(/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(receipt.executionId)); assert(id(receipt.commandType));
      assert(['COMPLETED', 'DENIED'].includes(receipt.status)); assert.equal(typeof receipt.replayed, 'boolean');
      assert(!seen.has(receipt.executionId), 'Duplicate settled execution identity'); seen.add(receipt.executionId);
    }
    if (candidate.pending) {
      exactKeys(candidate.pending, ['kind', 'day', 'logicalAt', 'command']); assert.equal(candidate.pending.kind, 'command');
      assert.equal(candidate.pending.day, candidate.lastDay); assert.equal(candidate.pending.logicalAt, candidate.lastLogicalAt);
      assert(issuedIdentity(candidate.pending.command)); assert(!seen.has(candidate.pending.command.executionIdentity.executionId));
    }
  }
  const api = {
    choose(view, { day, logicalAt }) {
      assert(integer(day) && integer(logicalAt)); assert(day >= (state.lastDay ?? 0) && logicalAt >= (state.lastLogicalAt ?? 0), 'Policy clock moved backwards');
      assert.equal(view.player?.id, accountId, 'Foreign player projection'); assert.equal(view.commandSchemaVersion, 1); assert(Array.isArray(view.commands));
      if (state.pending) return copy(state.pending);
      assert(!state.settled.some(r => r.status === 'COMPLETED' && r.replayed), 'Reconcile unknown completed replay before choosing again');
      const attempted = new Set(state.settled.map(r => r.executionId)), seen = new Set();
      const commands = view.commands.filter(command => {
        if (command.availability !== 'AVAILABLE' || !issuedIdentity(command)
          || !Number.isFinite(Date.parse(command.expiresAt)) || Date.parse(command.expiresAt) <= logicalAt) return false;
        const executionId = command.executionIdentity.executionId;
        assert(!seen.has(executionId), 'Duplicate issued execution identity'); seen.add(executionId);
        return !attempted.has(executionId);
      });
      const selected = chooseAuthorizedCommand({ commands }, { seed: configuration.seed, accountId, day, action: state.settled.length });
      state.observations++; state.lastDay = day; state.lastLogicalAt = logicalAt;
      if (!selected) { state.waits++; validate(); return { kind: 'wait', reason: 'no-unexpired-unattempted-public-command', day, logicalAt }; }
      state.pending = { kind: 'command', day, logicalAt, command: { commandId: selected.commandId, commandType: selected.commandType,
        executionIdentity: copy(selected.executionIdentity), parameters: copy(selected.parameters || {}) } };
      validate(); return copy(state.pending);
    },
    chooseCrime({ accountId: owner, character, publicCrimes }, { day }) {
      assert.equal(owner, accountId); assert(integer(day));
      assert(!state.pending, 'Settle pending command before choosing a crime');
      assert(!state.settled.some(r => r.status === 'COMPLETED' && r.replayed), 'Reconcile unknown completed replay before choosing again');
      assert(character && Number.isFinite(character.level) && Number.isFinite(character.nerve)); assert(Array.isArray(publicCrimes));
      if (character.hospSeconds > 0) return null;
      return copy(choosePublicCrime(character, publicCrimes, { seed: configuration.seed, accountId, day }));
    },
    settle(outcome) {
      assert(outcome && ['COMPLETED', 'DENIED'].includes(outcome.status), 'Unknown outcome remains pending');
      assert.equal(typeof outcome.replayed, 'boolean');
      const known = state.settled.find(r => r.executionId === outcome.executionId);
      if (known) { assert.equal(outcome.status, known.status, 'Conflicting duplicate settlement'); return { duplicate: true, ...api.summary() }; }
      assert.equal(outcome.executionId, state.pending?.command.executionIdentity.executionId, 'Unexpected completion identity');
      assert(state.pending);
      state.settled.push({ executionId: outcome.executionId, commandType: state.pending.command.commandType, status: outcome.status, replayed: outcome.replayed });
      state.pending = null; validate(); return api.summary();
    },
    checkpoint() { validate(); const payload = copy(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) { assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Cohort checkpoint checksum differs'); validate(checkpoint.payload); state = copy(checkpoint.payload); return api; },
    summary() {
      validate(); return { configuration: copy(configuration), observations: state.observations, waits: state.waits,
        freshCompletions: state.settled.filter(r => r.status === 'COMPLETED' && !r.replayed).length,
        denials: state.settled.filter(r => r.status === 'DENIED').length,
        unresolvedReplays: state.settled.filter(r => r.status === 'COMPLETED' && r.replayed).length,
        pending: !!state.pending, matrixQualifying: false };
    },
  };
  return api;
}
