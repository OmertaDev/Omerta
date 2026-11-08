import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { QUEST_QUALITY_PACKS, QUEST_QUALITY_PACK_NAMES } from '../src/content/quest-quality-packs.js';
import { QUALITY_PRESETS, QUALITY_MOTIVATION_SCENARIOS, validateQualityPack, analyzeQualityPack,
  factImpact, previewQualityPack, priorStatePreset, spoilerAudit } from '../tools/quest-quality-studio.js';

const byName = new Map(QUEST_QUALITY_PACK_NAMES.map((name, index) => [name, QUEST_QUALITY_PACKS[index]]));
const witness = byName.get('quest-three-witnesses-v2'), design = witness.nodes[0].payload.quality;
for (const pack of QUEST_QUALITY_PACKS) {
  const result = analyzeQualityPack(pack);
  assert(result.valid && result.contentHash.length === 64);
  assert(result.promises.every(row => row.unresolved.length === 0), 'Every declared narrative promise has a reachable payoff.');
  assert(result.branches.every(row => row.meaningfulReconvergence), 'Reconverging branches preserve different play or decisions.');
  assert(result.pacing.readingWords > 20 && result.pacing.estimateOnly && !result.pacing.observedPlayerTiming);
  assert(!result.playerResearchConducted && result.evidenceType === 'static-author-analysis');
  assert(!JSON.stringify(previewQualityPack(pack)).includes('"proofs"'));
}
const photoImpact = factImpact(witness, 'door-image');
assert.deepEqual(photoImpact.proofs, [{ puzzleId: 'finding', affectedProofs: 1, remainingSufficientProofs: 1, conclusionStillProvable: true }]);
assert(photoImpact.affectedNodes.includes('three-witnesses') && photoImpact.affectedNodes.includes('finding'));
const beforeChange = JSON.stringify(witness), change = factImpact(witness, 'door-image', { proposedText: 'The image shows a different person and cannot identify Luca.' });
assert(change.changesSourceText && change.semanticReviewRequired && !change.sourceMutated);
assert(change.producingScenes.includes('photo') && change.dialogueScenes.includes('rosa') && change.downstreamNodes.includes('commission'));
assert(change.dependentAnswerSpecs.includes('finding-answer'));
assert.equal(JSON.stringify(witness), beforeChange, 'Impact preview never edits the source fact.');
assert.throws(() => factImpact(witness, 'not-a-fact'));
const changed = structuredClone(witness);
changed.nodes.find(node => node.type === 'collectible_def').payload.title = 'Luca carried LA-17 through the east door';
assert(spoilerAudit(changed).some(row => row.surface === 'rewardTitle' && row.evidenceType === 'lexical-heuristic'), 'Spoiler audit inspects reward meaning against a private accepted conclusion.');
for (const verifier of ['unordered_ids', 'ordered_ids', 'mapping']) {
  const ordinary = structuredClone(witness), byId = new Map(ordinary.nodes.map(node => [node.id, node]));
  const puzzle = ordinary.nodes.find(node => node.type === 'puzzle' && byId.get(node.payload.answerSpecId)?.payload.verifier === verifier);
  const spec = byId.get(puzzle.payload.answerSpecId).payload;
  const answerId = verifier === 'mapping' ? Object.values(spec.solution)[0] : spec.solution[0];
  const answer = puzzle.payload.interaction.items.find(item => item.id === answerId).label;
  ordinary.nodes.find(node => node.type === 'collectible_def').payload.title = answer;
  validateQualityPack(ordinary);
  assert(spoilerAudit(ordinary).some(row => row.surface === 'rewardTitle' && row.verifier === verifier),
    `Ordinary ${verifier} answers are included in the pre-publication spoiler audit.`);
}
const normalized = structuredClone(witness), normalizedPuzzle = normalized.nodes.find(node => node.id === 'photo');
delete normalizedPuzzle.payload.interaction;
normalized.nodes.find(node => node.id === normalizedPuzzle.payload.answerSpecId).payload = { verifier: 'normalized_exact', acceptedValues: ['the courier used the east door'] };
normalized.nodes.find(node => node.type === 'collectible_def').payload.title = 'The courier used the east door';
validateQualityPack(normalized);
assert(spoilerAudit(normalized).some(row => row.surface === 'rewardTitle' && row.verifier === 'normalized_exact'));
const brokenPromise = structuredClone(witness);
brokenPromise.nodes[0].payload.quality.promises[0].payoffNodeIds = ['no-such-payoff'];
assert.throws(() => validateQualityPack(brokenPromise), /quality|missing|reference/i);
const cheatingNpc = structuredClone(witness);
cheatingNpc.nodes[0].payload.quality.revelations[0].evidenceIds = ['ledger-register'];
assert.throws(() => validateQualityPack(cheatingNpc), /knowledge|revelation/i);
const tooMany = structuredClone(witness); tooMany.nodes[0].payload.quality.budget.maxActions = 1;
assert(validateQualityPack(tooMany).warnings.some(row => row.code === 'action_budget'));
const fresh = previewQualityPack(witness, priorStatePreset(witness));
assert(!fresh.quality.clauses.some(row => row.evidenceNodeId === 'complete-exit-scope'));
assert(!fresh.ready.find(row => row.nodeId === 'clock-procedure').options.some(row => row.id === 'skip'));
const practiced = previewQualityPack(witness, { ...priorStatePreset(witness), masteredProcedures: ['quest.procedure.shared-clock'] });
assert(practiced.ready.find(row => row.nodeId === 'clock-procedure').options.some(row => row.id === 'skip'));
const filing = previewQualityPack(witness, priorStatePreset(witness, 'ready-to-file'));
assert.deepEqual(filing.ready.find(row => row.nodeId === 'finding').interaction.items.map(row => row.id), ['photo-proof', 'register-proof']);
assert(filing.blocked.some(row => row.nodeId === 'rosa'), 'Owning a fact does not silently teach the NPC that fact.');
const disclosed = previewQualityPack(witness, { ...priorStatePreset(witness, 'ready-to-file'), disclosures: [{ evidenceId: 'door-image', npcId: 'rosa' }] });
assert(disclosed.ready.some(row => row.nodeId === 'rosa'));
assert.equal(filing.runtimeExecuted, false); assert.equal(filing.authority, 'none');
assert.throws(() => previewQualityPack(witness, { completedNodeIds: ['invented'] }));
assert.throws(() => previewQualityPack(witness, { secretAnswer: true }));
assert.throws(() => previewQualityPack(witness, { choices: { commission: 'invented' } }));
assert.throws(() => priorStatePreset(witness, 'automatic-winning-state'));
const fieldPreview = previewQualityPack(byName.get('quest-quality-field-notes'));
assert(!fieldPreview.ready.some(row => row.nodeId === 'review') && fieldPreview.blocked.some(row => row.nodeId === 'review'));
assert.equal(fieldPreview.quality.fieldworkAssignments[0].outcomes, undefined);
assert(!JSON.stringify(fieldPreview).includes('P-4 appears in the complete dated register'));
assert.equal(QUALITY_MOTIVATION_SCENARIOS.length, 3);
for (const scenario of QUALITY_MOTIVATION_SCENARIOS) {
  const pack = byName.get(scenario.pack);
  for (const [nodeId, choiceId] of Object.entries(scenario.choices)) assert(pack.nodes.find(node => node.id === nodeId)?.payload.options.some(option => option.id === choiceId));
}
const cli = (...args) => execFileSync(process.execPath, ['tools/quest-quality-studio.js', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
assert.equal(JSON.parse(cli('validate', '--all')).length, 10);
assert.equal(JSON.parse(cli('preview', 'quest-three-witnesses-v2', '--preset', 'ready-to-file')).authority, 'none');
assert.equal(Object.keys(JSON.parse(cli('presets'))).length, Object.keys(QUALITY_PRESETS).length);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-quality-author-')), target = path.join(temporary, 'draft.json');
try {
  assert.equal(JSON.parse(cli('preset', 'clauses', '--out', target)).activated, false);
  assert(validateQualityPack(JSON.parse(fs.readFileSync(target, 'utf8'))).valid);
  assert.throws(() => cli('preset', 'clauses', '--out', target), /overwrite/);
  assert.throws(() => cli('silently-publish', target), /usage/);
} finally { if (fs.existsSync(target)) fs.unlinkSync(target); fs.rmdirSync(temporary); }
console.log(JSON.stringify({ phase: 'QUEST_QUALITY_AUTHOR_STUDIO', packs: 10, executableCli: true,
  factImpactAndAlternativeProofs: true, promises: true, branchConsequences: true, spoilerHeuristics: true,
  boundedPriorStatePreview: true, procedurePreset: design.procedures[0].id, playerResearchConducted: false, activation: false }));
