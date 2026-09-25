import assert from 'node:assert/strict';
import { PACING, levelOf } from '../src/rules.js';
import { planCohort, assessCohortBaseline, createCohortPolicy } from '../tools/rc1-cohort-policy.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

const scenarios = ['mostly_new_players', 'mostly_veteran_players'], seeds = ['rc1-alpha', 'rc1-beta', 'rc1-gamma'];
let plans = 0;
for (const scenarioId of scenarios) for (const population of [25, 100, 250, 500, 1000]) for (const seed of seeds) {
  const roster = Array.from({ length: population }, (_, i) => 'actor-' + i);
  const plan = planCohort({ scenarioId, seed, roster }), majority = Math.ceil(population * 9 / 10);
  assert.equal(plan.counts[plan.majorityCohort], majority); assert.equal(plan.counts.new + plan.counts.veteran, population);
  assert.deepEqual(plan, planCohort({ scenarioId, seed, roster: [...roster].reverse() }));
  assert.equal(plan.realized[scenarioId === 'mostly_new_players' ? 'newActorFraction' : 'veteranActorFraction'], population === 25 ? .92 : .9);
  assert.equal(plan.matrixQualifying, false);
  const observations = plan.actors.map(actor => ({ accountId: actor.accountId,
    character: { level: actor.initialization.targetLevel, respect: actor.initialization.respect },
    provenance: { kind: actor.initialization.kind, evidenceRef: 'retained-native/' + actor.accountId } }));
  for (const actor of plan.actors) {
    assert.equal(levelOf(actor.initialization.respect), actor.initialization.targetLevel);
    if (actor.cohort === 'veteran') assert.equal(actor.initialization.respect, PACING.LEVEL_DIVISOR * 74 ** 2);
    if (scenarioId === 'mostly_new_players' || actor.cohort === 'new') assert.deepEqual(actor.initialization.directWrites, {});
    else assert.deepEqual(actor.initialization.directWrites, { respect: PACING.LEVEL_DIVISOR * 74 ** 2 });
  }
  const baseline = assessCohortBaseline(plan, observations);
  assert(baseline.ready); assert.deepEqual(baseline.established, plan.counts); assert.equal(baseline.nativeProvenanceVerified, false);
  assert.equal(assessCohortBaseline(plan, observations.slice(1)).ready, false);
  const incomplete = structuredClone(observations), veteran = plan.actors.findIndex(a => a.cohort === 'veteran');
  incomplete[veteran].character = { level: 1, respect: 0 };
  assert.equal(assessCohortBaseline(plan, incomplete).ready, false, 'Labels do not establish veteran history');
  incomplete[veteran] = { ...observations[veteran], provenance: { kind: 'administrative-grant', evidenceRef: 'foreign' } };
  assert.equal(assessCohortBaseline(plan, incomplete).ready, false);
  plans++;
}

const options = { scenarioId: scenarios[0], seed: seeds[0], roster: Array.from({ length: 25 }, (_, i) => 'actor-' + i) };
const plan = planCohort(options), actor = plan.actors.find(a => a.cohort === 'new').accountId;
assert.notDeepEqual(plan.actors, planCohort({ ...options, seed: seeds[1] }).actors);
assert.throws(() => planCohort({ ...options, roster: [...options.roster.slice(1), options.roster[1]] }), /Duplicate/);
assert.throws(() => planCohort({ ...options, seed: 'unknown' }));
assert.throws(() => planCohort({ ...options, roster: options.roster.slice(1) }));
const start = Date.parse('2026-09-20T12:00:00Z');
const command = (n, extra = {}) => ({ commandId: String(n).repeat(64), commandType: 'mystery.start', availability: 'AVAILABLE',
  executionIdentity: { executionId: 'a'.repeat(64) + '.' + String(n).repeat(64) }, expiresAt: new Date(start + 60000).toISOString(), parameters: { graphId: 'public-' + n }, ...extra });
const view = commands => ({ player: { id: actor }, commandSchemaVersion: 1, commands });
const create = () => createCohortPolicy({ plan, accountId: actor });
const choices = [command(1), command(2)], policy = create();
const picked = policy.choose(view([...choices, command(3, { availability: 'LOCKED' }), command(4, { expiresAt: new Date(start).toISOString() })]), { day: 0, logicalAt: start });
assert(choices.some(c => c.commandId === picked.command.commandId));
assert.deepEqual(create().choose(view([...choices].reverse()), { day: 0, logicalAt: start }), picked);
assert.deepEqual(policy.choose(view([]), { day: 0, logicalAt: start + 1 }), picked, 'Lost response retains exact pending identity');
assert.throws(() => policy.settle({ status: 'UNKNOWN' }), /Unknown/);
const saved = policy.checkpoint(), restored = create().restore(saved);
assert.deepEqual(restored.choose(view([]), { day: 1, logicalAt: start + 2 }), picked);
for (const target of [policy, restored]) target.settle({ executionId: picked.command.executionIdentity.executionId, status: 'DENIED', replayed: false });
const next = policy.choose(view(choices), { day: 0, logicalAt: start + 3 });
assert.notEqual(next.command.commandId, picked.command.commandId, 'Refresh avoids the exact denied identity');
assert.deepEqual(restored.choose(view(choices), { day: 0, logicalAt: start + 3 }), next);
const completion = { executionId: next.command.executionIdentity.executionId, status: 'COMPLETED', replayed: false };
policy.settle(completion); policy.settle({ ...completion, replayed: true });
assert.equal(policy.summary().freshCompletions, 1); assert.equal(policy.summary().denials, 1);
assert.equal(policy.choose(view(choices), { day: 0, logicalAt: start + 4 }).kind, 'wait');
const newlyAvailable = command(5, { commandType: 'recipe.craft' });
assert.equal(policy.choose(view([newlyAvailable]), { day: 0, logicalAt: start + 5 }).command.commandId, newlyAvailable.commandId, 'Adapt to newly issued public choices');
assert.throws(() => create().choose({ ...view(choices), player: { id: 'foreign' } }, { day: 0, logicalAt: start }), /Foreign/);
assert.throws(() => create().choose(view([command(1), command(1)]), { day: 0, logicalAt: start }), /Duplicate/);
assert.equal(create().choose(view([command(1, { executionIdentity: null })]), { day: 0, logicalAt: start }).kind, 'wait');
const corrupted = structuredClone(saved); corrupted.payload.configuration.accountId = 'foreign';
assert.throws(() => create().restore(corrupted), /checksum/);
corrupted.sha256 = sha256(canonicalJson(corrupted.payload)); assert.throws(() => create().restore(corrupted));
const counters = structuredClone(saved); counters.payload.waits++; counters.sha256 = sha256(canonicalJson(counters.payload));
assert.throws(() => create().restore(counters));
const replay = create(), replayChoice = replay.choose(view(choices), { day: 0, logicalAt: start });
replay.settle({ executionId: replayChoice.command.executionIdentity.executionId, status: 'COMPLETED', replayed: true });
assert.equal(replay.summary().freshCompletions, 0); assert.equal(replay.summary().unresolvedReplays, 1);
assert.throws(() => replay.choose(view(choices), { day: 0, logicalAt: start }), /Reconcile/);
const crimePolicy = create(), publicCrimes = [{ id: 'pick', lvl: 1, nerve: 2 }, { id: 'advanced', lvl: 10, nerve: 4 }];
const crimeView = { accountId: actor, character: { level: 1, nerve: 3, jailSeconds: 0 }, publicCrimes };
assert.equal(crimePolicy.chooseCrime(crimeView, { day: 0 }).id, 'pick');
assert.equal(crimePolicy.chooseCrime({ ...crimeView, character: { ...crimeView.character, nerve: 1 } }, { day: 0 }), null);
assert.equal(crimePolicy.chooseCrime({ ...crimeView, character: { ...crimeView.character, jailSeconds: 10 } }, { day: 0 }), null);
assert.equal(crimePolicy.chooseCrime({ ...crimeView, character: { ...crimeView.character, hospSeconds: 10 } }, { day: 0 }).id, 'pick', 'Canonical crimes remain available in hospital');
assert.throws(() => crimePolicy.chooseCrime({ ...crimeView, accountId: 'foreign' }, { day: 0 }));
assert.throws(() => policy.chooseCrime(crimeView, { day: 0 }), /pending/);
assert.throws(() => replay.chooseCrime(crimeView, { day: 0 }), /Reconcile/);
assert.equal(crimePolicy.summary().freshCompletions, 0, 'A public crime choice is not a completed canonical action');
console.log(JSON.stringify({ status: 'PASS_SCOPED', cohortPlans: plans, populations: 5, seeds: 3, scenarios: 2,
  controls: 'counts/rounding, seed/order, progression formula, missing/forged setup, public eligibility/adaptation, denials, pending restart, checksum/identity/counters and unresolved replay', matrixQualifying: false }));
