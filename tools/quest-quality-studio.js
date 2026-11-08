#!/usr/bin/env node
// Author-only analysis and previews. This tool never activates content or writes gameplay state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContentPack, validateActivatableContentPack } from '../src/content/compiler.js';
import { validateQuestQuality, projectQuestQuality, qualityNpcKnowledge, qualitySpoilerAllows } from '../src/content/quality.js';
import { QUEST_QUALITY_PACK_NAMES } from '../src/content/quest-quality-packs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const words = text => String(text || '').match(/[\p{L}\p{N}]+/gu) || [];
const designOf = pack => pack.nodes.find(node => node.id === pack.runtime.entryNodeId).payload.quality;
const graphOf = pack => {
  const graph = new Map();
  for (const edge of pack.edges) if (['UNLOCKS', 'REVEALS'].includes(edge.type)) {
    if (!graph.has(edge.from)) graph.set(edge.from, []); graph.get(edge.from).push(edge.to);
  }
  return graph;
};
function descendants(graph, start, stop) {
  const seen = new Set(), todo = [start];
  while (todo.length) { const id = todo.pop(); if (id === stop || seen.has(id)) continue;
    seen.add(id); todo.push(...(graph.get(id) || [])); }
  return seen;
}

export const QUALITY_PRESETS = Object.freeze({
  'fair-mystery': 'quest-three-witnesses-v2', systemic: 'quest-quality-payday',
  clauses: 'quest-quality-truce', fieldwork: 'quest-quality-field-notes',
});
export const QUALITY_MOTIVATION_SCENARIOS = Object.freeze([
  { id: 'protect-suspect', pack: 'quest-quality-open-office', choices: { plan: 'witness', custody: 'sealed', closing: 'people' },
    requiredNodes: ['clerks', 'principle', 'sealed-check'], avoidedNodes: ['audit', 'public-check'], rationale: 'Protect the suspect from public exposure while retaining independent evidence and protecting legitimate dependants.' },
  { id: 'distrust-employer', pack: 'quest-three-witnesses-v2', choices: { commission: 'challenge', closing: 'precise' },
    requiredNodes: ['authority'], avoidedNodes: ['limits'], rationale: 'Challenge the requested accusation with a substantive authority investigation.' },
  { id: 'competing-loyalties', pack: 'quest-quality-small-fire', choices: { brief: 'bounded', closing: 'people' },
    requiredNodes: ['account'], avoidedNodes: ['repair'], rationale: 'Complete a signed finding while the employer and residents retain different priorities.' },
]);

export function loadQualityPack(fileOrName) {
  const file = QUEST_QUALITY_PACK_NAMES.includes(fileOrName)
    ? path.join(root, 'content', 'packs', fileOrName, 'pack.json') : path.resolve(fileOrName);
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink(), 'Use a regular authored JSON file.');
  assert(stat.size <= 2 * 1024 * 1024, 'Authored input is bounded to 2 MiB.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function validateQualityPack(pack) {
  const bundle = compileContentPack(pack); validateActivatableContentPack(bundle);
  const quality = validateQuestQuality(bundle);
  assert(pack.nodes.find(node => node.id === pack.runtime.entryNodeId)?.payload?.quality, 'An author-studio pack requires quality metadata.');
  return { namespace: pack.namespace, version: pack.version, contentHash: bundle.contentHash,
    valid: quality.errors.length === 0, errors: quality.errors, warnings: quality.warnings };
}

export function factImpact(pack, evidenceId, change = {}) {
  validateQualityPack(pack);
  assert(pack.nodes.some(node => node.id === evidenceId && node.type === 'evidence'), 'Select a declared evidence fact.');
  assert(change && Object.keys(change).every(key => key === 'proposedText'), 'Only proposedText is accepted for a fact-change preview.');
  if (change.proposedText !== undefined) assert(typeof change.proposedText === 'string' && change.proposedText.trim()
    && change.proposedText.length <= 4096, 'A proposed fact is bounded nonempty text.');
  const mentions = value => typeof value === 'string' ? value === evidenceId
    : Array.isArray(value) ? value.some(mentions) : value && typeof value === 'object' ? Object.values(value).some(mentions) : false;
  const nodeById = new Map(pack.nodes.map(node => [node.id, node]));
  const proofs = [];
  for (const puzzle of pack.nodes.filter(node => node.type === 'puzzle')) {
    const spec = nodeById.get(puzzle.payload.answerSpecId)?.payload;
    if (spec?.verifier !== 'proof_sets') continue;
    const removedItems = puzzle.payload.interaction.items.filter(item => item.evidenceNodeId === evidenceId).map(item => item.id);
    if (!removedItems.length) continue;
    const remaining = spec.proofs.filter(proof => !proof.evidenceIds.some(id => removedItems.includes(id)));
    proofs.push({ puzzleId: puzzle.id, affectedProofs: spec.proofs.length - remaining.length,
      remainingSufficientProofs: remaining.length, conclusionStillProvable: remaining.length > 0 });
  }
  const design = designOf(pack), graph = graphOf(pack);
  const dialogue = (design.revelations || []).filter(row => [...row.evidenceIds, ...row.requiresEvidenceIds].includes(evidenceId)).map(row => row.nodeId);
  const producers = pack.edges.filter(edge => edge.type === 'REVEALS' && edge.to === evidenceId).map(edge => edge.from);
  const directScenes = pack.nodes.filter(node => pack.runtime.actionNodeIds.includes(node.id) && mentions(node.payload)).map(node => node.id);
  const transitive = new Set([...directScenes, ...dialogue, ...producers].flatMap(id => [...descendants(graph, id)]));
  const fact = nodeById.get(evidenceId);
  return { evidenceId, ...(change.proposedText !== undefined ? { currentText: fact.payload.summary, proposedText: change.proposedText,
    changesSourceText: change.proposedText !== fact.payload.summary, sourceMutated: false } : {}),
    affectedNodes: pack.nodes.filter(node => node.id !== evidenceId && mentions(node.payload)).map(node => node.id),
    producingScenes: producers, dialogueScenes: dialogue, downstreamNodes: [...transitive].filter(id => id !== evidenceId),
    dependentAnswerSpecs: [...new Set([...directScenes, ...dialogue, ...producers].map(id => nodeById.get(id)?.payload.answerSpecId).filter(Boolean))],
    clauses: designOf(pack).clauses.filter(clause => clause.evidenceNodeId === evidenceId).map(clause => clause.id), proofs,
    semanticReviewRequired: true,
    interpretation: 'Static source, dialogue and proof dependency impact. A proposed replacement is previewed without changing the pack; authors must recheck whether each affected inference remains true.' };
}

export function spoilerAudit(pack) {
  const nodeById = new Map(pack.nodes.map(node => [node.id, node])), findings = [];
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'through', 'with', 'who', 'what', 'case', 'file', 'record']);
  for (const puzzle of pack.nodes.filter(node => node.type === 'puzzle')) {
    const payloads = [puzzle.payload, ...(puzzle.payload.variants || []).map(variant => ({ ...puzzle.payload, ...variant }))];
    for (const payload of payloads) {
    const spec = nodeById.get(payload.answerSpecId)?.payload;
    if (!spec) continue;
    const accepted = new Set(spec.verifier === 'proof_sets' ? spec.proofs.map(proof => proof.conclusionId)
      : spec.verifier === 'mapping' ? Object.values(spec.solution) : spec.solution || []);
    const conclusions = spec.verifier === 'proof_sets' ? payload.interaction.conclusions.filter(row => accepted.has(row.id))
      : spec.verifier === 'normalized_exact' ? spec.acceptedValues.map((label, index) => ({ id: `answer-${index}`, label }))
        : (payload.interaction?.items || []).filter(row => accepted.has(row.id));
    for (const conclusion of conclusions) {
      const tokens = new Set(words(conclusion.label).map(word => word.toLowerCase()).filter(word => !stop.has(word)));
      for (const node of pack.nodes) {
        const surfaces = { title: node.payload?.title, marker: node.payload?.marker, error: node.payload?.error,
          rewardTitle: node.type === 'collectible_def' ? node.payload?.title : undefined };
        for (const [surface, text] of Object.entries(surfaces)) if (typeof text === 'string') {
          const overlap = [...new Set(words(text).map(word => word.toLowerCase()))].filter(word => tokens.has(word));
          const exactAnswer = spec.verifier === 'normalized_exact' && conclusion.label.length >= 3
            && text.toLowerCase().includes(conclusion.label.toLowerCase());
          if (overlap.length >= 2 || exactAnswer) findings.push({ nodeId: node.id, surface, puzzleId: puzzle.id,
            verifier: spec.verifier, conclusionId: conclusion.id, overlap,
            code: 'possible_semantic_spoiler', severity: 'review', evidenceType: 'lexical-heuristic' });
        }
      }
    }
    }
  }
  return findings;
}

export function analyzeQualityPack(pack) {
  const validation = validateQualityPack(pack), design = designOf(pack), graph = graphOf(pack);
  const actions = new Set(pack.runtime.actionNodeIds), byId = new Map(pack.nodes.map(node => [node.id, node]));
  const promises = (design.promises || []).map(row => ({ ...row,
    unresolved: row.payoffNodeIds.filter(id => !descendants(graph, row.setupNodeId).has(id)) }));
  const branches = (design.branches || []).map(row => {
    const choice = byId.get(row.choiceNodeId), options = choice.payload.options.map(option => {
      const nodes = new Set((option.nextNodeIds || graph.get(choice.id) || []).flatMap(id => [...descendants(graph, id, row.reconvergeNodeId)]));
      return { optionId: option.id, actionsBeforeJoin: [...nodes].filter(id => actions.has(id)),
        retainedConsequences: (option.storyFlagIds || []).map(id => byId.get(id)?.payload).filter(Boolean).map(flag => ({ key: flag.key, value: flag.value })) };
    });
    return { ...row, options, budgetExceeded: options.some(option => option.actionsBeforeJoin.length > row.maxActions),
      meaningfulReconvergence: new Set(options.map(option => JSON.stringify([option.actionsBeforeJoin, option.retainedConsequences]))).size > 1 };
  });
  const categories = { reasoning: [], dialogue: [], procedures: [], travel: [], quiet: [...(design.pacing?.safeNodeIds || [])], possibleChores: [] };
  const procedureNodes = new Set((design.procedures || []).flatMap(row => [row.nodeId, row.learnNodeId]));
  const prompts = new Map(); let readingWords = 0;
  for (const node of pack.nodes) {
    if (node.type === 'answer_spec') continue;
    readingWords += [...new Set([node.payload?.prompt, node.payload?.summary].filter(Boolean))].reduce((sum, text) => sum + words(text).length, 0);
    if (node.type === 'puzzle') categories[node.payload.interaction?.kind === 'interrogation' ? 'dialogue' : 'reasoning'].push(node.id);
    if (procedureNodes.has(node.id)) categories.procedures.push(node.id);
    if (node.payload?.gates?.some(gate => gate.kind === 'at_location')) categories.travel.push(node.id);
    if (node.payload?.prompt) { const key = node.payload.prompt.trim().toLowerCase(); if (!prompts.has(key)) prompts.set(key, []); prompts.get(key).push(node.id); }
  }
  categories.possibleChores = [...prompts.values()].filter(ids => ids.length > 1).map(nodeIds => ({ nodeIds, reason: 'Repeated identical instructions; review whether the repeated activity adds reasoning.' }));
  return { ...validation, promises, branches, spoilers: spoilerAudit(pack),
    pacing: { readingWords, estimatedReadingMinutes: Math.round(readingWords / 180 * 10) / 10,
      estimateOnly: true, observedPlayerTiming: false, categories },
    factImpacts: pack.nodes.filter(node => node.type === 'evidence').map(node => factImpact(pack, node.id)),
    evidenceType: 'static-author-analysis', nativeExecution: false, playerResearchConducted: false };
}

export function previewQualityPack(pack, state = {}) {
  validateQualityPack(pack);
  assert(state && Object.keys(state).every(key => ['completedNodeIds', 'choices', 'masteredProcedures', 'roleId', 'disclosures'].includes(key)), 'Closed author preview state required.');
  const byId = new Map(pack.nodes.map(node => [node.id, node]));
  const design = designOf(pack), roles = pack.nodes.filter(node => node.type === 'role').map(node => node.id);
  const roleId = state.roleId || roles[0]; assert(roles.includes(roleId), 'Preview role must exist.');
  assert(Array.isArray(state.masteredProcedures || []) && (state.masteredProcedures || []).length <= 16
    && (state.masteredProcedures || []).every(flag => design.procedures?.some(row => row.masteryFlag === flag)), 'Preview mastery must name a declared procedure.');
  assert(Array.isArray(state.completedNodeIds || []) && (state.completedNodeIds || []).every(id => byId.has(id)), 'Preview completion references must name real nodes.');
  const completed = new Set(state.completedNodeIds || []); completed.add(pack.runtime.entryNodeId); completed.add('opening');
  const choiceResults = state.choices || {}; assert(choiceResults && typeof choiceResults === 'object' && !Array.isArray(choiceResults));
  for (const [id, optionId] of Object.entries(choiceResults)) assert(byId.get(id)?.payload.options?.some(option => option.id === optionId), 'Preview choices must name actual options.');
  const disclosures = state.disclosures || []; assert(Array.isArray(disclosures) && disclosures.length <= 64);
  for (const row of disclosures) assert(row && Object.keys(row).every(key => ['npcId', 'evidenceId'].includes(key)) && completed.has(row.evidenceId)
    && design.disclosures?.some(item => item.evidenceId === row.evidenceId && item.recipients.some(recipient => recipient.npcId === row.npcId)), 'Preview disclosures must use known evidence and a whitelisted recipient.');
  const visible = new Set(completed), ready = [], blocked = [];
  for (const node of pack.nodes.filter(node => pack.runtime.actionNodeIds.includes(node.id) && !completed.has(node.id))) {
    const incoming = pack.edges.filter(edge => edge.type === 'UNLOCKS' && edge.to === node.id);
    const unlocked = edge => completed.has(edge.from) && (!choiceResults[edge.from]
      || !byId.get(edge.from)?.payload.options?.find(option => option.id === choiceResults[edge.from])?.nextNodeIds
      || byId.get(edge.from).payload.options.find(option => option.id === choiceResults[edge.from]).nextNodeIds.includes(node.id));
    if (incoming.length && (node.payload.unlockMode === 'any' ? incoming.some(unlocked) : incoming.every(unlocked))) {
      const unmet = (node.payload.gates || []).filter(gate => gate.kind === 'completed_node' ? !completed.has(gate.nodeId)
        : gate.kind === 'party_role' ? roleId !== gate.role : false).map(gate => gate.nodeId || gate.role);
      for (const revelation of (design.revelations || []).filter(row => row.nodeId === node.id)) {
        const known = qualityNpcKnowledge(design, revelation.npcId, completed,
          new Set(disclosures.filter(row => row.npcId === revelation.npcId).map(row => row.evidenceId)));
        unmet.push(...revelation.requiresEvidenceIds.filter(id => !known.has(id)));
      }
      if (unmet.length || !qualitySpoilerAllows(design, node.id, completed)) {
        blocked.push({ nodeId: node.id, unmetEvidenceOrRole: [...new Set(unmet)], spoilerPrerequisiteMet: qualitySpoilerAllows(design, node.id, completed) });
        continue;
      }
      visible.add(node.id);
      const interaction = node.payload.interaction ? structuredClone(node.payload.interaction) : undefined;
      if (interaction?.items?.some(item => item.evidenceNodeId)) interaction.items = interaction.items.filter(item => completed.has(item.evidenceNodeId));
      const procedure = designOf(pack).procedures?.find(row => row.nodeId === node.id);
      const options = node.payload.options?.filter(option => option.id !== procedure?.skipOptionId || state.masteredProcedures?.includes(procedure.masteryFlag));
      ready.push({ nodeId: node.id, kind: node.type, title: node.payload.title, prompt: node.payload.prompt,
        ...(interaction ? { interaction } : {}), ...(options ? { options: options.map(({ id, label }) => ({ id, label })) } : {}),
        unmetEvidence: [] });
    }
  }
  return { mode: 'author-preview', runtimeExecuted: false, authority: 'none', completedNodeIds: [...completed],
    quality: projectQuestQuality(design, visible), ready, blocked,
    scenes: [...completed].map(id => byId.get(id)).filter(node => node && ['chapter', 'evidence'].includes(node.type))
      .map(node => ({ id: node.id, title: node.payload.title, summary: node.payload.summary })) };
}

export function priorStatePreset(pack, preset = 'fresh') {
  const entry = pack.runtime.entryNodeId;
  if (preset === 'fresh') return { completedNodeIds: [entry, 'opening'] };
  if (preset === 'first-fact') {
    const fact = pack.nodes.find(node => node.type === 'evidence'); assert(fact, 'Preset requires evidence.');
    return { completedNodeIds: [entry, 'opening', fact.id] };
  }
  if (preset === 'ready-to-file') {
    const spec = pack.nodes.find(node => node.type === 'answer_spec' && node.payload.verifier === 'proof_sets');
    assert(spec, 'This preset requires a proof-set case.');
    const puzzle = pack.nodes.find(node => node.payload?.answerSpecId === spec.id), selected = spec.payload.proofs[0].evidenceIds;
    return { completedNodeIds: [entry, 'opening', ...(designOf(pack).procedures || []).flatMap(row => [row.nodeId, row.learnNodeId]),
      ...puzzle.payload.interaction.items.filter(item => selected.includes(item.id)).map(item => item.evidenceNodeId)],
      choices: Object.fromEntries((designOf(pack).procedures || []).map(row => [row.nodeId, row.learnOptionId])) };
  }
  throw new Error('Unknown prior-state preset. Use fresh, first-fact, or ready-to-file.');
}

async function main(args) {
  const [command, target, ...rest] = args;
  if (command === 'presets') return console.log(JSON.stringify(QUALITY_PRESETS, null, 2));
  if (command === 'preset') {
    assert(Object.hasOwn(QUALITY_PRESETS, target), 'Choose a listed preset.');
    const outAt = rest.indexOf('--out'); assert(outAt >= 0 && rest[outAt + 1], 'preset requires --out <new.json>');
    const output = path.resolve(rest[outAt + 1]); assert(!fs.existsSync(output), 'Preset refuses to overwrite an existing file.');
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(loadQualityPack(QUALITY_PRESETS[target]), null, 2) + '\n');
    return console.log(JSON.stringify({ output, activated: false }));
  }
  const targets = target === '--all' ? QUEST_QUALITY_PACK_NAMES : [target];
  assert(target && ['validate', 'report', 'impact', 'preview', 'scenarios'].includes(command), 'usage: quest-quality-studio.js validate|report|impact|preview|scenarios <pack-name|file|--all>; presets; preset <name> --out <new.json>');
  const results = targets.map(name => {
    const pack = loadQualityPack(name);
    if (command === 'validate') return validateQualityPack(pack);
    if (command === 'report') return analyzeQualityPack(pack);
    if (command === 'impact') {
      const replaceAt = rest.indexOf('--replace');
      return factImpact(pack, rest[0], replaceAt >= 0 ? { proposedText: rest[replaceAt + 1] } : {});
    }
    if (command === 'scenarios') return QUALITY_MOTIVATION_SCENARIOS.filter(row => row.pack === name);
    const presetAt = rest.indexOf('--preset'), stateAt = rest.indexOf('--state');
    const state = stateAt >= 0 ? JSON.parse(fs.readFileSync(rest[stateAt + 1], 'utf8'))
      : priorStatePreset(pack, presetAt >= 0 ? rest[presetAt + 1] : 'fresh');
    return previewQualityPack(pack, state);
  });
  console.log(JSON.stringify(target === '--all' ? results : results[0], null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
