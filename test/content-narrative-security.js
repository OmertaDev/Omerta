import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileContentPack, validateRuntimeContentPack } from '../src/content/compiler.js';
import { verifyNarrativeSubmission } from '../src/content/narrative.js';
import { publicGateState } from '../src/content/runtime.js';

const base = JSON.parse(fs.readFileSync(new URL('./fixtures/content/runtime-minimal.json', import.meta.url), 'utf8'));
for (const reserved of ['runtime.invite:outside-account', 'runtime.note:forged', 'runtime.handoff:forged']) {
  const source = structuredClone(base);
  source.nodes.find(node => node.type === 'world_fact').payload.key = reserved;
  assert.throws(() => validateRuntimeContentPack(compileContentPack(source)), /non-reserved key/,
    'authored facts cannot forge invitation, communication, or handoff authority');
}
const ignored = structuredClone(base);
ignored.nodes.find(node => node.id === ignored.runtime.terminalNodeId).payload.gates = [
  { kind: 'story_flag_is', key: 'never.recorded', value: 'required' },
];
assert.throws(() => validateRuntimeContentPack(compileContentPack(ignored)), /entry or actionable node/,
  'the activation profile cannot promise an unevaluated terminal gate');

const items = ['one', 'two', 'three'].map(id => ({ id, label: id }));
const interaction = { kind: 'timeline', items };
const permutations = values => values.length ? values.flatMap((value, index) => permutations(values.filter((_, n) => index !== n)).map(rest => [value, ...rest])) : [[]];
let checks = 0;
for (let mask = 0; mask < 8; mask++) {
  const subset = items.filter((_, index) => mask & (1 << index)).map(item => item.id);
  for (const candidate of permutations(subset)) {
    const ordered = verifyNarrativeSubmission({ payload: { verifier: 'ordered_ids', solution: ['one', 'two'] } }, interaction, { ids: candidate });
    const unordered = verifyNarrativeSubmission({ payload: { verifier: 'unordered_ids', solution: ['one', 'two'] } }, interaction, { ids: candidate });
    assert.equal(ordered.matched === true, candidate.join(',') === 'one,two');
    assert.equal(unordered.matched === true, candidate.length === 2 && candidate.includes('one') && candidate.includes('two'));
    checks += 2;
  }
}
const mapping = { kind: 'inventory', items, slots: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second' }] };
for (const first of items) for (const second of items) {
  const result = verifyNarrativeSubmission({ payload: { verifier: 'mapping', solution: { first: 'one', second: 'two' } } }, mapping, { assignments: { first: first.id, second: second.id } });
  assert.equal(result.matched, first.id === 'one' && second.id === 'two'); checks++;
}
for (const submission of [null, [], { ids: ['outside'] }, { ids: ['one', 'one'] }, { ids: ['one'], effect: 'grant' }, { assignments: {} }]) {
  assert.equal(verifyNarrativeSubmission({ payload: { verifier: 'ordered_ids', solution: ['one'] } }, interaction, submission).valid, false); checks++;
}
const graph = { nodeById: new Map([
  ['private-proof', { type: 'evidence', payload: { shareScope: 'role_private', roleId: 'watcher' } }],
]) };
assert.equal(Object.hasOwn(publicGateState({}, {}, { kind: 'completed_node', nodeId: 'private-proof' }, graph, 'signatory'), 'nodeId'), false,
  'a gate explanation cannot reveal another role’s private evidence identity');
assert.equal(publicGateState({}, {}, { kind: 'completed_node', nodeId: 'private-proof' }, graph, 'watcher').nodeId, 'private-proof');
console.log(`✓ narrative security: reserved metadata and ignored gates rejected, private references scoped, ${checks} exhaustive structured-answer checks passed`);
