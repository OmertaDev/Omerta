import assert from 'node:assert/strict';
import { createRecordedActors, actorValueHash, compareActorReplay, ACTOR_REPLAY_COMPARISON_FIELDS } from '../tools/rc1-native-actor-replay.js';
import { observedOpportunityTracker } from '../tools/rc1-native-player-policy.js';

const identity = { accountId: 'actor', logicalAt: 1000 }, view = { available: ['issued'], cash: '9007199254740993', deadline: new Date(1000) };
const observed = createRecordedActors();
await observed.decide('choice', identity, view, () => ({ executionId: 'issued' }));
await observed.observe('outcome', identity, { completed: true, cash: '9007199254740992' });
const tape = observed.finish(), replay = createRecordedActors({ replay: tape });
assert.deepEqual(await replay.decide('choice', identity, view, () => { throw Error('Recorded decision must be used'); }), { executionId: 'issued' });
await replay.observe('outcome', identity, { completed: true, cash: '9007199254740992' });
assert.equal(replay.finish().entriesSha256, tape.entriesSha256);
assert.notEqual(actorValueHash(view), actorValueHash({ ...view, deadline: new Date(1001) }), 'Every native timestamp retained');
for (const invalid of [{ absent: undefined }, { fn: () => {} }, { symbol: Symbol('unsupported') }, [Infinity], [,], new Map(), new Date(NaN)])
  assert.throws(() => actorValueHash(invalid), 'Actor comparison must not silently omit non-JSON evidence');
for (const changed of [{ ...view, cash: '9007199254740994' }, { ...view, available: [] }, { ...view, deadline: new Date(1001) }]) {
  const control = createRecordedActors({ replay: tape });
  await assert.rejects(control.decide('choice', identity, changed, () => null), /exact authorized input differs/);
  assert.equal(control.diagnostic().failures.length, 1); assert.throws(() => control.finish(), /rejected/);
}
assert.throws(() => createRecordedActors({ replay: { ...tape, complete: false } }));
assert.throws(() => createRecordedActors({ replay: { ...tape, entries: [] } }), /hash differs/);
assert.throws(() => createRecordedActors({ replay: tape }).finish(), /Unconsumed/);
const compared = Object.fromEntries(ACTOR_REPLAY_COMPARISON_FIELDS.map((key) => [key, 'same']));
compareActorReplay(compared, compared);
for (const key of ACTOR_REPLAY_COMPARISON_FIELDS)
  assert.throws(() => compareActorReplay({ ...compared, [key]: 'changed' }, compared), /differs/);
const tracker = observedOpportunityTracker();
tracker.observe('actor', [{ opportunityId: 'visible' }], 10); tracker.observe('actor', [{ opportunityId: 'visible' }], 20);
const checkpoint = tracker.checkpoint(), restored = observedOpportunityTracker(); restored.restore(checkpoint);
assert.deepEqual(restored.summarize(30), tracker.summarize(30));
restored.observe('actor', [{ opportunityId: 'visible' }], 40);
assert.equal(restored.checkpoint().rows[0].firstSeen, 10); assert.equal(restored.checkpoint().rows[0].lastSeen, 40);
assert.throws(() => restored.restore(checkpoint), /before adding/);
assert.throws(() => observedOpportunityTracker().restore({ ...checkpoint, rows: [...checkpoint.rows, ...checkpoint.rows] }), /Duplicate/);
console.log('PASS: exact actor decisions/outcomes, semantic mutation controls, complete comparator and observation checkpoint');
