import assert from 'node:assert/strict';
import { validateQuestQuality, assertQuestQuality, projectQuestQuality, qualityNpcKnowledge,
  qualitySpoilerAllows } from '../src/content/quality.js';
import { validateNarrativeAnswer, validateNarrativePuzzle, verifyNarrativeSubmission } from '../src/content/narrative.js';

const spec = { id: 'answer', type: 'answer_spec', payload: { verifier: 'proof_sets', proofs: [
  { conclusionId: 'forgery', evidenceIds: ['receipt', 'clock'] },
  { conclusionId: 'forgery', evidenceIds: ['witness', 'ink'] },
] } };
const interaction = { kind: 'deduction', items: [
  { id: 'receipt', label: 'Receipt', evidenceNodeId: 'e1' },
  { id: 'clock', label: 'Clock', evidenceNodeId: 'e2' },
  { id: 'witness', label: 'Witness', evidenceNodeId: 'e3' },
  { id: 'ink', label: 'Ink', evidenceNodeId: 'e4' },
], conclusions: [{ id: 'forgery', label: 'The document was forged' }, { id: 'mistake', label: 'An honest mistake' }] };
const context = { knownEvidenceNodeIds: new Set(['e1', 'e2', 'e3', 'e4']) };
const check = (submission, ctx = context) => verifyNarrativeSubmission(spec, interaction, submission, ctx);
validateNarrativeAnswer(spec, 'fixture');
for (const evidenceIds of [['receipt', 'clock'], ['clock', 'receipt'], ['witness', 'ink']]) {
  assert.deepEqual(check({ conclusionId: 'forgery', evidenceIds }), { valid: true, matched: true });
}
for (const submission of [
  { conclusionId: 'mistake', evidenceIds: ['clock', 'receipt'] },
  { conclusionId: 'forgery', evidenceIds: ['receipt'] },
  { conclusionId: 'forgery', evidenceIds: ['receipt', 'clock', 'witness', 'ink'] },
]) assert.deepEqual(check(submission), { valid: true, matched: false });
for (const submission of [null, {}, { conclusionId: 'unknown', evidenceIds: ['receipt'] },
  { conclusionId: 'forgery', evidenceIds: [] }, { conclusionId: 'forgery', evidenceIds: ['receipt', 'receipt'] },
  { conclusionId: 'forgery', evidenceIds: ['unknown'] }, { conclusionId: 'forgery', evidenceIds: ['receipt'], matched: true },
  { conclusionId: 'forgery', evidenceIds: 'receipt' },
]) assert.deepEqual(check(submission), { valid: false });
assert.deepEqual(check({ conclusionId: 'forgery', evidenceIds: ['receipt', 'clock'] }, {}), { valid: false });
assert.deepEqual(check({ conclusionId: 'forgery', evidenceIds: ['receipt', 'clock'] },
  { knownEvidenceNodeIds: new Set(['e1']) }), { valid: false }, 'A valid guess cannot cite undiscovered evidence.');
assert.deepEqual(check(Object.assign(Object.create({ fake: true }), { conclusionId: 'forgery', evidenceIds: ['receipt'] })), { valid: false });
const badSpec = (change) => { const copy = structuredClone(spec); change(copy.payload); assert.throws(() => validateNarrativeAnswer(copy, 'fixture')); };
badSpec((payload) => { payload.solution = ['receipt']; });
badSpec((payload) => { payload.proofs = []; });
badSpec((payload) => { payload.proofs.push({ conclusionId: 'forgery', evidenceIds: ['clock', 'receipt'] }); });
badSpec((payload) => { payload.proofs[0].evidenceIds = ['receipt', 'receipt']; });
badSpec((payload) => { payload.proofs[0].conclusionId = 'x'.repeat(161); });
badSpec((payload) => { payload.proofs = Array.from({ length: 33 }, (_, i) => ({ conclusionId: 'c' + i, evidenceIds: ['receipt'] })); });
const nodes = new Map([spec, ...['e1', 'e2', 'e3', 'e4'].map((id) => ({ id, type: 'evidence' }))].map((node) => [node.id, node]));
const puzzle = { id: 'puzzle', type: 'puzzle', payload: { answerSpecId: 'answer', interaction } };
validateNarrativePuzzle(puzzle, nodes, new Set(nodes.keys()));
const invalidLink = structuredClone(puzzle); invalidLink.payload.interaction.items[0].evidenceNodeId = 'answer';
assert.throws(() => validateNarrativePuzzle(invalidLink, nodes, new Set(nodes.keys())), /profiled evidence/);
const invalidConclusion = structuredClone(puzzle); invalidConclusion.payload.interaction.conclusions = [{ id: 'mistake', label: 'Mistake' }];
assert.throws(() => validateNarrativePuzzle(invalidConclusion, nodes, new Set(nodes.keys())), /unknown public/);

// These exact legacy shapes and results remain compatible with the original three verifiers.
for (const [verifier, solution, board, submission, matched] of [
  ['ordered_ids', ['a', 'b'], { items: [{ id: 'a' }, { id: 'b' }] }, { ids: ['a', 'b'] }, true],
  ['ordered_ids', ['a', 'b'], { items: [{ id: 'a' }, { id: 'b' }] }, { ids: ['b', 'a'] }, false],
  ['unordered_ids', ['a', 'b'], { items: [{ id: 'a' }, { id: 'b' }] }, { ids: ['b', 'a'] }, true],
  ['mapping', { lock: 'a' }, { items: [{ id: 'a' }, { id: 'b' }], slots: [{ id: 'lock' }] }, { assignments: { lock: 'a' } }, true],
  ['mapping', { lock: 'a' }, { items: [{ id: 'a' }, { id: 'b' }], slots: [{ id: 'lock' }] }, { assignments: { lock: 'b' } }, false],
]) assert.deepEqual(verifyNarrativeSubmission({ payload: { verifier, solution } }, board, submission), { valid: true, matched });

function fixture() {
  const node = (id, type, payload = {}) => ({ id, type, payload });
  const nodes = [node('entry', 'mystery'), node('choose', 'choice', { options: [
    { id: 'learn', nextNodeIds: ['procedure'] }, { id: 'skip', nextNodeIds: ['ending'] },
  ] }), node('procedure', 'puzzle'), node('ending', 'puzzle'), node('ask', 'choice'), node('done', 'terminal'),
  node('e1', 'evidence'), node('e2', 'evidence'), node('e3', 'evidence', { evidenceKind: 'testimony' }), node('e4', 'evidence'),
  node('party', 'party_policy'), node('reader', 'role')];
  const edge = (from, to, type = 'UNLOCKS') => ({ from, to, type });
  const quality = { version: 1, question: 'Which account explains the record?',
    assumptions: [{ id: 'clock-rule', text: 'The station clock is accurate.' }],
    clauses: [{ id: 'observed', text: 'The signature was dry.', evidenceNodeId: 'e1' },
      { id: 'concealed', text: 'PRIVATE_CLAUSE', evidenceNodeId: 'e2' }],
    motives: [{ id: 'protect', label: 'Protect the witness' }],
    identity: { activity: 'Investigate a record', emotionalTurn: 'Doubt becomes clarity' },
    questions: [{ id: 'late-question', text: 'PRIVATE_QUESTION', nodeId: 'ending' }],
    spotlights: [{ nodeId: 'ask', roleId: 'reader' }],
    npcs: [{ id: 'sara', label: 'Sara', knowledge: [{ evidenceNodeId: 'e1', sourceNodeId: 'entry' },
      { evidenceNodeId: 'e2', sourceNodeId: 'entry' }], beliefs: [{ evidenceNodeId: 'e3', sourceNodeId: 'entry' }],
    conceals: ['e2'], principles: ['Protect patients'], voice: 'Measured and concise' }],
    revelations: [{ nodeId: 'ask', npcId: 'sara', evidenceIds: ['e1', 'e3'], requiresEvidenceIds: ['e2'] }],
    promises: [{ id: 'answer-promise', setupNodeId: 'entry', payoffNodeIds: ['done'] }],
    branches: [{ choiceNodeId: 'choose', reconvergeNodeId: 'ending', maxActions: 3 }],
    budget: { maxActions: 6, maxNewConcepts: 3, maxReadingWords: 200 },
    spoilers: [{ nodeId: 'e2', requiresNodeIds: ['e1'] }],
    pacing: { pressureNodeIds: ['choose', 'procedure'], safeNodeIds: ['ending'], maxConsecutivePressure: 2 },
    procedures: [{ id: 'reading', nodeId: 'choose', learnNodeId: 'procedure', masteryFlag: 'quest.procedure.reading', skipOptionId: 'skip', learnOptionId: 'learn' }],
    fieldworkAssignments: [{ id: 'lab', title: 'Inspect the paper', questions: [{ id: 'date', label: 'When?' }, { id: 'ink', label: 'Which ink?' }],
      methods: [{ id: 'read', label: 'Read it' }, { id: 'compare', label: 'Compare it' }],
      outcomes: ['date', 'ink'].flatMap((questionId) => ['read', 'compare'].map((methodId) => ({ questionId, methodId,
        report: 'PRIVATE_FIELDWORK_REPORT', evidenceNodeIds: questionId === 'ink' && methodId === 'compare' ? ['e4'] : [] }))) }],
    disclosures: [{ evidenceId: 'e1', recipients: [{ npcId: 'sara', label: 'Show Sara the observation', report: 'PRIVATE_DISCLOSURE_REPORT', revealNodeIds: ['e2'] }] }],
  };
  nodes[0].payload.quality = quality;
  return { nodes, edges: [edge('entry', 'choose'), edge('entry', 'ask'), edge('choose', 'procedure'), edge('choose', 'ending'),
    edge('procedure', 'ending'), edge('ending', 'done'), edge('ask', 'e1', 'REVEALS'), edge('e1', 'e2'), edge('party', 'reader', 'PERFORMED_BY_ROLE')],
  runtime: { entryNodeId: 'entry', terminalNodeId: 'done', partyPolicyId: 'party', nodeIds: nodes.map((row) => row.id), actionNodeIds: ['choose', 'procedure', 'ending', 'ask'] } };
}
const designOf = (bundle) => bundle.nodes[0].payload.quality;
assert.deepEqual(validateQuestQuality(fixture()), { errors: [], warnings: [] });
assert.deepEqual(validateQuestQuality({ nodes: [], edges: [] }), { errors: [], warnings: [] });
let refusals = 0;
function refuses(change, code) {
  const bundle = fixture(); change(designOf(bundle), bundle);
  const result = validateQuestQuality(bundle);
  assert(result.errors.some((row) => row.code === code), JSON.stringify(result));
  assert.throws(() => assertQuestQuality(bundle), /Invalid quest quality/); refusals++;
}
refuses((q) => { q.extra = true; }, 'closed_shape');
refuses((q) => { q.version = 2; }, 'version');
refuses((q) => { q.question = ''; }, 'text');
refuses((q) => { q.assumptions.push({ ...q.assumptions[0] }); }, 'duplicate_id');
refuses((q) => { q.clauses[0].evidenceNodeId = 'ending'; }, 'node_reference');
refuses((q) => { q.spotlights.push({ ...q.spotlights[0] }); }, 'duplicate_spotlight');
refuses((q) => { q.spotlights[0].nodeId = 'e1'; }, 'spotlight_reference');
refuses((q, b) => { b.nodes.push({ id: 'second', type: 'role', payload: {} }); b.runtime.nodeIds.push('second');
  b.edges.push({ from: 'party', to: 'second', type: 'PERFORMED_BY_ROLE' }); }, 'quality_handoff_required');
refuses((q) => { q.npcs[0].knowledge = {}; }, 'bounded_array');
refuses((q) => { q.npcs[0].conceals = ['e4']; }, 'concealed_unknown');
refuses((q) => { q.npcs[0].knowledge[0].sourceNodeId = 'ask'; }, 'unjustified_revelation');
refuses((q) => { q.npcs[0].knowledge[0].sourceNodeId = 'procedure'; }, 'unjustified_revelation');
refuses((q) => { q.revelations[0].evidenceIds = ['e4']; }, 'unjustified_revelation');
refuses((q) => { q.revelations[0].npcId = 'nobody'; }, 'npc_reference');
refuses((q) => { q.promises[0].setupNodeId = 'e2'; }, 'unreachable_payoff');
refuses((q, b) => { b.edges.push({ from: 'choose', to: 'done', type: 'UNLOCKS' }); }, 'branch_reconvergence');
refuses((q) => { q.spoilers[0].requiresNodeIds = ['e2']; }, 'self_spoiler');
refuses((q) => { q.budget.maxActions = 0; }, 'budget');
refuses((q) => { q.pacing.safeNodeIds = ['choose']; }, 'pacing_overlap');
refuses((q) => { q.procedures[0].masteryFlag = 'unrelated.power'; }, 'procedure_flag');
refuses((q) => { q.procedures[0].skipOptionId = 'learn'; }, 'procedure_options');
refuses((q) => { q.procedures[0].learnNodeId = 'ask'; }, 'node_reference');
refuses((q, b) => { b.nodes[1].payload.options[1].nextNodeIds = ['procedure']; }, 'procedure_skip_path');
refuses((q) => { q.fieldworkAssignments[0].outcomes.pop(); }, 'fieldwork_coverage');
refuses((q) => { q.fieldworkAssignments[0].outcomes[0] = q.fieldworkAssignments[0].outcomes[1]; }, 'fieldwork_combination');
refuses((q) => { q.fieldworkAssignments[0].outcomes[3].evidenceNodeIds = ['ending']; }, 'node_reference');
refuses((q) => { q.disclosures[0].recipients[0].revealNodeIds = ['e4']; }, 'unjustified_revelation');
refuses((q) => { q.npcs[0].beliefs = [{ evidenceNodeId: 'e1', sourceNodeId: 'entry' }]; q.npcs[0].knowledge.shift(); }, 'unjustified_revelation');
const warns = fixture(); designOf(warns).budget = { maxActions: 1, maxNewConcepts: 1, maxReadingWords: 1 };
const handoff = fixture(); handoff.nodes.push({ id: 'second', type: 'role', payload: {} }); handoff.runtime.nodeIds.push('second');
handoff.edges.push({ from: 'party', to: 'second', type: 'PERFORMED_BY_ROLE' });
handoff.nodes.find(node => node.id === 'party').payload.allowRoleReplacement = true;
assert.equal(assertQuestQuality(handoff).errors.length, 0, 'A real replacement policy permits the cooperative case.');
const warnings = assertQuestQuality(warns).warnings;
assert(warnings.some((row) => row.code === 'action_budget') && warnings.some((row) => row.code === 'reading_budget'));
const pressure = fixture(); designOf(pressure).pacing = { pressureNodeIds: ['choose', 'procedure', 'ending'], safeNodeIds: [], maxConsecutivePressure: 2 };
assert(assertQuestQuality(pressure).warnings.some((row) => row.code === 'pressure_run'));

const design = designOf(fixture());
assert.deepEqual([...qualityNpcKnowledge(design, 'sara', new Set())], []);
assert.deepEqual([...qualityNpcKnowledge(design, 'sara', new Set(['entry']))].sort(), ['e1', 'e2']);
assert.deepEqual([...qualityNpcKnowledge(design, 'sara', new Set(), new Set(['e4']))], ['e4']);
assert(!qualityNpcKnowledge(design, 'sara', new Set(['entry'])).has('e3'), 'Belief does not silently become knowledge.');
assert.equal(qualityNpcKnowledge(design, 'unknown', new Set(['entry']), new Set(['e1'])).size, 0);
assert.equal(qualitySpoilerAllows(design, 'e2', new Set(['e2'])), false);
const hidden = projectQuestQuality(design, new Set(['entry', 'e2']));
const encoded = JSON.stringify(hidden);
for (const secret of ['PRIVATE_', 'sourceNodeId', 'conceals', 'beliefs', 'knowledge', 'revealNodeIds', 'outcomes', 'payoffNodeIds']) assert(!encoded.includes(secret));
assert.equal(hidden.clauses.length, 0); assert.equal(hidden.disclosures.length, 0);
const publicView = projectQuestQuality(design, new Set(['entry', 'e1', 'e2', 'ending']));
assert.equal(publicView.clauses.length, 2); assert.equal(publicView.questions.length, 1); assert.equal(publicView.disclosures.length, 1);
publicView.npcs[0].principles.push('Changed by caller');
assert.equal(design.npcs[0].principles.length, 1, 'Public arrays cannot mutate the authored contract.');
assert.equal(projectQuestQuality(undefined, new Set()), null);
console.log(`quest-quality-rules: PASS multiple sufficient proofs, known-evidence enforcement, select-all refusal, legacy verifier compatibility; ${refusals} author refusals, warnings, NPC provenance, procedure paths and spoiler-safe projections`);
