import assert from 'node:assert/strict';
import { applyQualityOperation, newQualityActor, newQualityShared } from '../src/content/quality-runtime.js';
import { QUEST_QUALITY_PACKS } from '../src/content/quest-quality-packs.js';

const pack = QUEST_QUALITY_PACKS.find(pack => pack.runtime.experienceId === 'quality-field-notes');
const design = pack.nodes.find(node => node.id === pack.runtime.entryNodeId).payload.quality;
const context = { instance: { id: 'stateful-case', status: 'active' }, accountId: 'actor',
  members: [{ account_id: 'actor', role_id: 'investigator', participant_kind: 'agent' }],
  knownEvidence: new Set(), actions: [], completed: new Set([pack.runtime.entryNodeId]),
  nodeById: new Map(pack.nodes.map(node => [node.id, node])), now: Date.parse('2026-11-08T12:00:00Z') };
let seed = 0x50cafe, actor = newQualityActor(), shared = newQualityShared(), accepted = 0, refused = 0;
const random = maximum => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % maximum; };
for (let step = 0; step < 1200; step++) {
  const inputs = [
    { operation: 'save_draft', text: `Private interpretation ${step}`, evidenceIds: [] },
    { operation: 'save_draft', text: 'Inventing a clue', evidenceIds: ['unseen-clue'] },
    { operation: 'first_impression', text: `Uncertain observation ${step}`, unsure: true, share: false },
    { operation: 'first_impression', text: 'Not a boolean', unsure: 'true', share: false },
    { operation: 'set_motive', motiveId: design.motives[0].id },
    { operation: 'study_consent', consent: true, evidenceType: 'ai', familiarity: 'new' },
    { operation: 'study_consent', consent: true, evidenceType: 'self_reported_human', familiarity: 'new' },
    { operation: 'study_recall', memory: 'Too early', enjoyment: 5, understanding: 5 },
    { operation: 'study_comprehension', answers: { what: 'a', why: 'b', next: 'c' } },
    { operation: 'open_debrief' },
    { operation: 'disclose', evidenceId: 'registry-report', npcId: 'clerk' },
    { operation: 'fieldwork', assignmentId: 'permit-check', questionId: 'registered', methodId: 'invented-method' },
    { operation: 'save_draft', text: 'Wrong operation fields', evidenceIds: [], actorAccountId: 'someone-else' },
  ];
  const input = { expectedRevision: 1, expectedQualityRevision: actor.revision + (random(5) === 0 ? -1 : 0), ...inputs[random(inputs.length)] };
  const beforeActor = JSON.stringify(actor), beforeShared = JSON.stringify(shared);
  try {
    const next = applyQualityOperation(design, context, actor, shared, input);
    assert.equal(next.actor.revision, actor.revision + 1);
    assert.equal(next.publicChange, false, 'The generated successful operations are explicitly private.');
    assert.deepEqual(next.revealNodeIds, [], 'Private reasoning cannot produce NPC testimony or fieldwork evidence.');
    assert.equal(JSON.stringify(next.shared), beforeShared);
    actor = next.actor; shared = next.shared; accepted++;
  } catch (error) {
    assert(['bad_request', 'stale_quality', 'unknown_evidence', 'study_not_due', 'study_unavailable', 'study_evidence_type', 'case_active'].includes(error.code), error.stack);
    assert.equal(JSON.stringify(actor), beforeActor); assert.equal(JSON.stringify(shared), beforeShared); refused++;
  }
}
assert(accepted > 100 && refused > 100);
console.log(JSON.stringify({ phase: 'QUEST_QUALITY_STATEFUL', seed: '0x50cafe', transitions: 1200,
  accepted, refused, privateProgressIsolation: true, invalidTransitionsAtomic: true, humanResults: false }));
