import assert from 'node:assert/strict';
import {
  COORDINATION_GRAPH_LIMITS, CoordinationGraphError, compileCoordinationGraph,
  coordinationEvidenceKey, coordinationGraph, coordinationGraphs, createCoordinationRegistry, evaluateRule,
} from '../src/coordination/graph.js';
import { COORDINATION_PILOT, COORDINATION_KNOWLEDGE_PILOT, COORDINATION_ALL_PILOTS } from '../src/coordination/pilot.js';

const always = () => ({ kind: 'always' });
const done = (nodeId) => ({ kind: 'node_completed', nodeId });
const all = (...rules) => ({ kind: 'all', rules });
const node = (id, overrides = {}) => ({
  id, kind: 'task', title: `Task ${id}`, visibility: 'public',
  discover: always(), requires: always(), ...overrides,
});
const source = () => ({
  schemaVersion: 1, id: 'omerta.coordination.foundation', version: 1, title: 'The Foundation',
  nodes: [
    node('first'),
    node('second', { visibility: 'hidden', discover: done('first') }),
    node('finish', { kind: 'terminal', requires: done('second') }),
  ],
});
const rejects = (mutate, code) => {
  const value = source(); mutate(value);
  assert.throws(() => compileCoordinationGraph(value), (error) => error instanceof CoordinationGraphError
    && (!code || error.code === code), code || 'invalid definition');
};

const input = source();
const compiled = compileCoordinationGraph(input);
assert.match(compiled.contentHash, /^[0-9a-f]{64}$/);
assert.notEqual(compiled.nodes, input.nodes);
const assertFrozen = (value) => {
  if (!value || typeof value !== 'object') return;
  assert(Object.isFrozen(value));
  for (const child of Object.values(value)) assertFrozen(child);
};
assertFrozen(compiled);
input.nodes[0].title = 'Changed';
input.nodes[1].discover.nodeId = 'finish';
assert.equal(compiled.nodes.find(({ id }) => id === 'first').title, 'Task first');
assert.equal(compiled.nodes.find(({ id }) => id === 'second').discover.nodeId, 'first');
assert.throws(() => { compiled.nodes[0].requires.kind = 'unknown'; }, TypeError);
assert.throws(() => compiled.nodes.push(node('extra')), TypeError);
assert.equal(compileCoordinationGraph(source()).contentHash, compiled.contentHash);
const reordered = source();
reordered.nodes.reverse();
assert.equal(compileCoordinationGraph(reordered).contentHash, compiled.contentHash,
  'node declaration order does not change definition identity');
const objectReordered = JSON.parse(JSON.stringify(source()), (_key, value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).reverse());
  return value;
});
assert.equal(compileCoordinationGraph(objectReordered).contentHash, compiled.contentHash,
  'property order does not change definition identity');
const grouped = source();
grouped.nodes[2].requires = all(done('second'), done('first'));
const groupedHash = compileCoordinationGraph(grouped).contentHash;
grouped.nodes[2].requires.rules.reverse();
assert.equal(compileCoordinationGraph(grouped).contentHash, groupedHash,
  'commutative predicate order does not change definition identity');
const newVersion = source(); newVersion.version = 2;
assert.notEqual(compileCoordinationGraph(newVersion).contentHash, compiled.contentHash);

const registry = createCoordinationRegistry([source()]);
assertFrozen(registry);
assert.equal(coordinationGraphs(registry).length, 1);
assert.equal(coordinationGraph(registry, compiled.id).contentHash, compiled.contentHash);
assert.equal(coordinationGraph(registry, 'missing'), null);
for (const fake of [null, {}, Object.freeze({ graphs: Object.freeze([compiled]) })]) {
  assert.throws(() => coordinationGraphs(fake), { code: 'coordination_registry_invalid' });
  assert.throws(() => coordinationGraph(fake, compiled.id), { code: 'coordination_registry_invalid' });
}
assert.throws(() => createCoordinationRegistry([source(), newVersion]), { code: 'coordination_graph_duplicate' });
console.log('coordination-graph: isolated immutable definitions, canonical identity and registry authority pass');

const predicates = [done('first'), { kind: 'level_at_least', level: 3 }, { kind: 'at_district', districtId: 'docks' }];
const state = { completed: new Set(['first']), level: 3, district: 'docks', elapsedSeconds: 10 };
assert.equal(evaluateRule(always()), true);
assert.equal(evaluateRule(all(...predicates), state), true);
assert.equal(evaluateRule(all(...predicates), { ...state, level: 2 }), false);
assert.equal(evaluateRule({ kind: 'any', rules: predicates }, { completed: new Set(['first']) }), true);
assert.equal(evaluateRule({ kind: 'any', rules: predicates }, {}), false);
for (let mask = 0; mask < 8; mask++) {
  const facts = {
    completed: new Set(mask & 1 ? ['first'] : []),
    level: mask & 2 ? 3 : 2, district: mask & 4 ? 'docks' : 'foundry',
  };
  const satisfied = Number(!!(mask & 1)) + Number(!!(mask & 2)) + Number(!!(mask & 4));
  for (let count = 1; count <= 3; count++) {
    assert.equal(evaluateRule({ kind: 'at_least', count, rules: predicates }, facts), satisfied >= count);
  }
}
const clockRule = { kind: 'elapsed_at_least', seconds: 10 };
assert.equal(evaluateRule(clockRule, { elapsedSeconds: 9.99 }), false);
assert.equal(evaluateRule(clockRule, { elapsedSeconds: 10 }), true);
for (const badElapsed of [undefined, null, NaN, Infinity, -1, '10']) {
  assert.equal(evaluateRule(clockRule, { elapsedSeconds: badElapsed }), false);
}
for (const badLevel of [undefined, null, NaN, Infinity, 3.1, '3']) {
  assert.equal(evaluateRule(predicates[1], { level: badLevel }), false);
}
for (const missing of [undefined, null, [], { has: () => true }]) {
  assert.equal(evaluateRule(done('first'), { completed: missing }), false);
}
class OverriddenSet extends Set { has() { throw new Error('Do not call client overrides.'); } }
assert.equal(evaluateRule(done('first'), { completed: new OverriddenSet(['first']) }), true);
assert.equal(evaluateRule(predicates[1], Object.create({ level: 3 })), false);
assert.equal(evaluateRule(predicates[1], { get level() { throw new Error('No getters'); } }), false);
const nested = all({ kind: 'any', rules: [done('first'), done('second')] }, clockRule);
assert.equal(evaluateRule(nested, state), true);
assert.equal(evaluateRule({ kind: 'any', rules: [always(), { kind: 'unknown' }] }, state), false,
  'a short circuit cannot authorize an invalid rule');
assert.equal(evaluateRule({ kind: 'at_least', count: 2, rules: [always(), always()] }, state), false,
  'duplicate conditions cannot manufacture quorum');
console.log('coordination-graph: AND, OR, every M-of-N truth table, clocks and missing state pass');

for (const mutate of [
  (s) => { delete s.schemaVersion; }, (s) => { s.schemaVersion = 3; },
  (s) => { s.extra = true; }, (s) => { s.effects = []; }, (s) => { s.rewards = {}; },
  (s) => { s.authority = 'account'; }, (s) => { s.metadata = {}; },
  (s) => { s.contentHash = compiled.contentHash; }, (s) => { s.version = 0; },
  (s) => { s.version = 2_147_483_648; },
  (s) => { s.version = 1.5; }, (s) => { s.version = '1'; },
  (s) => { s.id = ' padded'; }, (s) => { s.id = 'a/b'; },
  (s) => { s.title = ''; }, (s) => { s.title = '\uD800'; },
  (s) => { s.nodes[0].effect = { kind: 'cash' }; },
  (s) => { s.nodes[0].kind = 'reward'; }, (s) => { s.nodes[0].visibility = 'role_private'; },
  (s) => { delete s.nodes[0].discover; }, (s) => { delete s.nodes[0].requires; },
  (s) => { s.nodes[0].description = 1; }, (s) => { s.nodes[0].title = 'x'.repeat(201); },
  (s) => { s.nodes[0].description = 'x'.repeat(2_001); },
  (s) => { s.nodes[0].title = 'line\nbreak'; },
  (s) => { s.nodes[0].constructor = {}; },
  (s) => { Object.setPrototypeOf(s.nodes[0], { extra: true }); },
  (s) => { s.nodes[0][Symbol('hidden')] = true; },
  (s) => { Object.defineProperty(s.nodes[0], 'extra', { value: true }); },
  (s) => { Object.defineProperty(s, 'nodes', { get() { throw new Error('must not execute getter'); } }); },
  (s) => { Object.defineProperty(s.nodes, '0', { get() { throw new Error('must not execute getter'); } }); },
  (s) => { Object.setPrototypeOf(s.nodes, { map() { throw new Error('must not execute inherited array code'); } }); },
  (s) => { s.nodes.extra = true; }, (s) => { delete s.nodes[1]; },
]) rejects(mutate);
const maximumVersion = source(); maximumVersion.version = 2_147_483_647;
assert.equal(compileCoordinationGraph(maximumVersion).version, maximumVersion.version,
  'definition versions fit the persisted PostgreSQL INTEGER type');
const inheritedRules = [always()];
Object.setPrototypeOf(inheritedRules, { map() { throw new Error('must not execute inherited predicate code'); } });
rejects((s) => { s.nodes[0].requires = { kind: 'all', rules: inheritedRules }; }, 'coordination_rule_invalid');
assert.equal(evaluateRule({ kind: 'all', rules: inheritedRules }, state), false);
for (const badRule of [
  null, [], () => true, { kind: 'unknown' }, { kind: 'always', value: true },
  { kind: 'all', rules: [] }, { kind: 'any', rules: [always(), always()] },
  { kind: 'at_least', count: 0, rules: [always()] },
  { kind: 'at_least', count: 2, rules: [always()] },
  { kind: 'at_least', count: 1.5, rules: [always()] },
  { kind: 'node_completed' }, { kind: 'node_completed', nodeId: '' },
  { kind: 'level_at_least', level: 0 }, { kind: 'level_at_least', level: '2' },
  { kind: 'elapsed_at_least', seconds: -0 }, { kind: 'elapsed_at_least', seconds: -1 },
  { kind: 'elapsed_at_least', seconds: Infinity }, { kind: 'at_district', districtId: [] },
]) {
  rejects((s) => { s.nodes[0].requires = badRule; });
  assert.equal(evaluateRule(badRule, state), false);
}
const cyclicRule = { kind: 'all', rules: [] }; cyclicRule.rules.push(cyclicRule);
rejects((s) => { s.nodes[0].requires = cyclicRule; }, 'coordination_definition_limit');
assert.equal(evaluateRule(cyclicRule, state), false);
rejects((s) => { s.nodes[1].id = 'first'; }, 'coordination_graph_duplicate');
rejects((s) => { s.nodes[0].requires = done('missing'); }, 'coordination_graph_reference');
rejects((s) => { s.nodes[0].discover = done('missing'); }, 'coordination_graph_reference');
rejects((s) => { s.nodes[0].requires = done('first'); }, 'coordination_graph_cycle');
rejects((s) => { s.nodes[0].discover = done('second'); }, 'coordination_graph_cycle');
rejects((s) => { s.nodes[0].requires = done('finish'); }, 'coordination_graph_cycle');
rejects((s) => { s.nodes[1].discover = always(); }, 'coordination_graph_disconnected');
rejects((s) => { s.nodes[2].kind = 'task'; });
rejects((s) => { s.nodes[0].kind = 'terminal'; });
const alternatives = source();
alternatives.nodes[1].discover = always();
alternatives.nodes[2].requires = { kind: 'any', rules: [done('first'), done('second')] };
assert.doesNotThrow(() => compileCoordinationGraph(alternatives),
  'both optional branches have a structural path to the terminal');
console.log('coordination-graph: hostile schemas, hidden references, cycles and disconnected branches pass');

const depthRule = (depth) => depth === 1 ? always() : all(depthRule(depth - 1));
const maxDepth = source(); maxDepth.nodes[0].requires = depthRule(COORDINATION_GRAPH_LIMITS.ruleDepth);
assert.doesNotThrow(() => compileCoordinationGraph(maxDepth));
rejects((s) => { s.nodes[0].requires = depthRule(COORDINATION_GRAPH_LIMITS.ruleDepth + 1); }, 'coordination_definition_limit');
const chain = (length) => ({
  schemaVersion: 1, id: 'bounded', version: 1, title: 'Bounded chain',
  nodes: Array.from({ length }, (_, index) => node(`n${index}`, {
    kind: index === length - 1 ? 'terminal' : 'task',
    requires: index ? done(`n${index - 1}`) : always(),
  })),
});
assert.doesNotThrow(() => compileCoordinationGraph(chain(64)));
assert.throws(() => compileCoordinationGraph(chain(65)), { code: 'coordination_definition_limit' });
const wide = source();
wide.nodes[0].requires = all(...Array.from({ length: 506 }, (_, index) => ({ kind: 'level_at_least', level: index + 1 })));
assert.doesNotThrow(() => compileCoordinationGraph(wide), '512 predicates including all discover/requires roots are accepted');
wide.nodes[0].requires.rules.push({ kind: 'level_at_least', level: 507 });
assert.throws(() => compileCoordinationGraph(wide), { code: 'coordination_definition_limit' });
console.log('coordination-graph: node, depth and aggregate predicate limits pass');

// Schema 1 is a byte-for-byte stable profile; schema 2 cannot reinterpret its stored definitions.
assert.equal(coordinationGraphs(COORDINATION_PILOT).length, 1);
assert.equal(coordinationGraphs(COORDINATION_PILOT)[0].contentHash,
  '519695a8262ee96126dfa378ebdd4d7010a489b59e76d924f35900964c51e3c6');
const v2Plain = source(); v2Plain.schemaVersion = 2;
assert.notEqual(compileCoordinationGraph(v2Plain).contentHash, compiled.contentHash);
assert.equal(coordinationGraphs(COORDINATION_ALL_PILOTS).length, 2);
const knowledge = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
assert.equal(knowledge.schemaVersion, 2);
assertFrozen(knowledge);
const knowledgeSource = () => {
  const { contentHash: _hash, ...definition } = knowledge;
  return JSON.parse(JSON.stringify(definition));
};
const knowledgeNode = (definition, id) => definition.nodes.find((entry) => entry.id === id);
const evidenceRule = () => JSON.parse(JSON.stringify(knowledgeNode(knowledge, 'conclusion').requires.rules
  .find((rule) => rule.kind === 'independent_evidence')));
const rejectKnowledge = (mutate, expectedCode) => {
  const definition = knowledgeSource(); mutate(definition);
  assert.throws(() => compileCoordinationGraph(definition), (error) => error instanceof CoordinationGraphError
    && (!expectedCode || error.code === expectedCode));
};
const reorderKnowledge = knowledgeSource();
reorderKnowledge.nodes.reverse();
for (const rule of ['discover', 'requires']) {
  knowledgeNode(reorderKnowledge, 'conclusion')[rule].rules.reverse();
  knowledgeNode(reorderKnowledge, 'conclusion')[rule].rules.find((entry) => entry.kind === 'independent_evidence').sourceRoots.reverse();
}
assert.equal(compileCoordinationGraph(reorderKnowledge).contentHash, knowledge.contentHash);
assert.equal(coordinationEvidenceKey(evidenceRule()), coordinationEvidenceKey({ ...evidenceRule(),
  sourceRoots: [...evidenceRule().sourceRoots].reverse() }));
assert.throws(() => coordinationEvidenceKey(always()), { code: 'coordination_rule_invalid' });
rejectKnowledge((s) => { s.schemaVersion = 1; });
rejects((s) => { s.nodes[1].claim = knowledgeNode(knowledge, 'docks-source').claim; });
rejects((s) => { s.nodes[2].requires = evidenceRule(); }, 'coordination_rule_invalid');

const claimMutations = [
  (claim) => { claim.domain = 'other/domain'; }, (claim) => { claim.proposition = ''; },
  (claim) => { claim.sourceRoot = 'x'.repeat(129); }, (claim) => { claim.owner = 'caller'; },
  (claim) => { delete claim.value; }, (claim) => { claim.value = { type: 'number', value: 1 }; },
  (claim) => { claim.value = { type: 'boolean', value: 'true' }; },
  (claim) => { claim.value = { type: 'integer', value: 0.5 }; },
  (claim) => { claim.value = { type: 'integer', value: -0 }; },
  (claim) => { claim.value = { type: 'integer', value: Number.MAX_SAFE_INTEGER + 1 }; },
  (claim) => { claim.value = { type: 'text', value: 'x'.repeat(201) }; },
  (claim) => { claim.value = { type: 'text', value: ' padded' }; },
  (claim) => { claim.value = { type: 'text', value: '\uD800' }; },
  (claim) => { claim.value = { type: 'text', value: 'line\nbreak' }; },
  (claim) => { claim.value = { type: 'text', value: 'valid', extra: true }; },
  (claim) => { claim.value = () => true; },
  (claim) => { Object.defineProperty(claim, 'value', { get() { throw new Error('No claim getters'); } }); },
  (claim) => { Object.setPrototypeOf(claim.value, { type: 'text' }); },
  (claim) => { claim.value[Symbol('extra')] = true; },
];
for (const mutate of claimMutations) rejectKnowledge((s) => mutate(knowledgeNode(s, 'docks-source').claim));
rejectKnowledge((s) => { knowledgeNode(s, 'docks-source').visibility = 'public'; }, 'coordination_claim_invalid');
rejectKnowledge((s) => { knowledgeNode(s, 'conclusion').claim = knowledgeNode(s, 'docks-source').claim; }, 'coordination_claim_invalid');
rejectKnowledge((s) => { knowledgeNode(s, 'foundry-source').claim.sourceRoot = 'docks.manifest'; }, 'coordination_claim_invalid');
rejectKnowledge((s) => { knowledgeNode(s, 'docks-source').claim.domain = 'other.domain'; }, 'coordination_claim_reference');
rejectKnowledge((s) => { knowledgeNode(s, 'docks-source').claim.proposition = 'other.proposition'; }, 'coordination_claim_reference');
rejectKnowledge((s) => { knowledgeNode(s, 'docks-source').claim.value.value = 'different'; }, 'coordination_claim_reference');

const invalidEvidenceRules = [
  { ...evidenceRule(), sourceRoots: ['docks.manifest'] },
  { ...evidenceRule(), sourceRoots: ['docks.manifest', 'foundry.impression', 'third'] },
  { ...evidenceRule(), sourceRoots: ['docks.manifest', 'docks.manifest'] },
  { ...evidenceRule(), sourceRoots: ['docks.manifest', {}] },
  { ...evidenceRule(), count: 1 }, { ...evidenceRule(), accountCount: 1 },
  { ...evidenceRule(), contentHash: 'a'.repeat(64) },
  { ...evidenceRule(), domain: '' }, { ...evidenceRule(), proposition: 'wrong/name' },
  { ...evidenceRule(), value: { type: 'integer', value: '1' } },
  { ...evidenceRule(), value: { type: 'text', value: '\uD800' } },
];
for (const rule of invalidEvidenceRules) {
  rejectKnowledge((s) => { knowledgeNode(s, 'conclusion').requires = rule; });
  assert.equal(evaluateRule(rule, {}), false);
}
rejectKnowledge((s) => { knowledgeNode(s, 'conclusion').requires = { ...evidenceRule(), sourceRoots: ['absent', 'docks.manifest'] }; },
  'coordination_claim_reference');
rejectKnowledge((s) => { knowledgeNode(s, 'docks-source').discover = evidenceRule(); }, 'coordination_graph_cycle');
const rootGetterRule = evidenceRule();
Object.defineProperty(rootGetterRule.sourceRoots, '0', { get() { throw new Error('No source getters'); } });
assert.equal(evaluateRule(rootGetterRule), false);
rejectKnowledge((s) => { knowledgeNode(s, 'conclusion').requires = rootGetterRule; });

// Every closed primitive has valid exact semantics. Contradictory extra sources remain representable.
for (const value of [{ type: 'boolean', value: true }, { type: 'boolean', value: false },
  { type: 'integer', value: Number.MAX_SAFE_INTEGER }, { type: 'integer', value: -Number.MAX_SAFE_INTEGER },
  { type: 'text', value: 'x'.repeat(200) }, { type: 'text', value: 'città' }]) {
  const definition = knowledgeSource();
  for (const entry of definition.nodes) {
    if (entry.claim) entry.claim.value = value;
    for (const rule of [entry.discover, entry.requires]) {
      for (const child of rule.rules || []) if (child.kind === 'independent_evidence') child.value = value;
    }
  }
  assert.doesNotThrow(() => compileCoordinationGraph(definition));
}
const contradiction = knowledgeSource();
contradiction.nodes.push(node('contradicting-source', { visibility: 'hidden', discover: done('briefing'),
  claim: { ...knowledgeNode(contradiction, 'docks-source').claim, sourceRoot: 'third.receipt',
    value: { type: 'text', value: 'assembled-before-the-fire' } } }));
for (const rule of ['discover', 'requires']) {
  knowledgeNode(contradiction, 'conclusion')[rule].rules.find((entry) => entry.kind === 'any').rules.push(done('contradicting-source'));
}
assert.doesNotThrow(() => compileCoordinationGraph(contradiction));
console.log('coordination-graph: schema 2 typed claims, exact source dependencies, contradictions and v1 hash stability pass');

const gate = evidenceRule(), gateKey = coordinationEvidenceKey(gate);
const resolution = { satisfied: true, contentHash: knowledge.contentHash, receiptIds: ['receipt-a', 'receipt-b'] };
const evidenceState = (result = resolution) => ({ contentHash: knowledge.contentHash, evidence: new Map([[gateKey, result]]) });
assert.equal(evaluateRule(gate, evidenceState()), true);
assert.equal(evaluateRule({ kind: 'all', rules: [gate, done('docks-source')] },
  { ...evidenceState(), completed: new Set(['docks-source']) }), true);
for (const result of [undefined, true, () => true, {}, { ...resolution, satisfied: false },
  { ...resolution, satisfied: 'true' }, { ...resolution, contentHash: 'b'.repeat(64) },
  { ...resolution, receiptIds: ['receipt-a', 'receipt-a'] }, { ...resolution, receiptIds: ['receipt-a'] },
  { ...resolution, receiptIds: ['receipt-a', 'receipt-b', 'receipt-c'] },
  { ...resolution, receiptIds: ['receipt-a', {}] }, { ...resolution, extra: true },
  { ...resolution, receiptIds: { every: () => true, length: 2 } },
  { ...resolution, get satisfied() { throw new Error('No resolution getters'); } }]) {
  // Pass undefined as an explicit missing map entry rather than using the helper's default.
  assert.equal(evaluateRule(gate, { contentHash: knowledge.contentHash, evidence: new Map([[gateKey, result]]) }), false);
}
for (const state of [{}, { evidence: new Map([[gateKey, resolution]]) },
  { ...evidenceState(), contentHash: 'not-a-hash' }, { ...evidenceState(), contentHash: 'b'.repeat(64) },
  { ...evidenceState(), evidence: { get: () => resolution } },
  { ...evidenceState(), evidence: () => resolution },
  { ...evidenceState(), evidence: new Map([['wrong-key', resolution]]) },
  Object.create(evidenceState()), { get evidence() { throw new Error('No state getters'); } }]) {
  assert.equal(evaluateRule(gate, state), false);
}
class OverriddenEvidenceMap extends Map { get() { throw new Error('No map callback'); } }
assert.equal(evaluateRule(gate, { contentHash: knowledge.contentHash, evidence: new OverriddenEvidenceMap([[gateKey, resolution]]) }), true);
const alteredGate = { ...gate, proposition: 'other.proposition' };
assert.equal(evaluateRule(alteredGate, evidenceState()), false);
assert.equal(evaluateRule({ kind: 'any', rules: [always(), { ...gate, count: 1 }] }, evidenceState()), false);
console.log('coordination-graph: pure exact-rule/hash-bound evidence result evaluation rejects callbacks and malformed receipts');

const v2MaxDepth = knowledgeSource(); knowledgeNode(v2MaxDepth, 'briefing').requires = depthRule(8);
assert.doesNotThrow(() => compileCoordinationGraph(v2MaxDepth));
rejectKnowledge((s) => { knowledgeNode(s, 'briefing').requires = depthRule(9); }, 'coordination_definition_limit');
const v2MaxNodes = chain(64); v2MaxNodes.schemaVersion = 2;
assert.doesNotThrow(() => compileCoordinationGraph(v2MaxNodes));
const v2TooManyNodes = chain(65); v2TooManyNodes.schemaVersion = 2;
assert.throws(() => compileCoordinationGraph(v2TooManyNodes), { code: 'coordination_definition_limit' });
const v2Wide = source(); v2Wide.schemaVersion = 2;
v2Wide.nodes[0].requires = all(...Array.from({ length: 506 }, (_, index) => ({ kind: 'level_at_least', level: index + 1 })));
assert.doesNotThrow(() => compileCoordinationGraph(v2Wide));
v2Wide.nodes[0].requires.rules.push({ kind: 'level_at_least', level: 507 });
assert.throws(() => compileCoordinationGraph(v2Wide), { code: 'coordination_definition_limit' });
console.log('coordination-graph: schema 2 preserves node, depth and total-rule bounds');
