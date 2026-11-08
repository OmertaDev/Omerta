import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { projectQuestQuality, qualityNpcKnowledge, qualitySpoilerAllows } from './quality.js';

const reject = (code, message) => { throw new GameError(code, message); };
const text = (value, maximum = 4000) => typeof value === 'string' && value.length <= maximum;
const ids = value => Array.isArray(value) && value.length <= 64 && new Set(value).size === value.length
  && value.every(id => typeof id === 'string' && id.length > 0 && id.length <= 160);
export const qualityMemberId = (instanceId, accountId) => crypto.createHash('sha256')
  .update(`${instanceId}\0${accountId}`).digest('hex').slice(0, 32);
export const qualityActorKey = accountId => `runtime.quality.actor:${accountId}`;
export const QUALITY_SHARED_KEY = 'runtime.quality.shared';
export const qualityDesign = graph => graph.nodeById.get(graph.runtime.entryNodeId)?.payload?.quality;
export const newQualityActor = () => ({ revision: 0, draft: { text: '', evidenceIds: [] },
  motiveId: null, firstImpression: { text: '', unsure: true, shared: false }, debriefOpened: false, study: null });
export const newQualityShared = () => ({ disclosures: [], fieldworkReports: [], delegations: {} });
export function qualityStates(facts, accountId) {
  return {
    actor: structuredClone(facts.find(fact => fact.key === qualityActorKey(accountId))?.value || newQualityActor()),
    shared: structuredClone(facts.find(fact => fact.key === QUALITY_SHARED_KEY)?.value || newQualityShared()),
  };
}
export function qualityControlledEvidence(design) {
  return new Set([
    ...(design?.fieldworkAssignments || []).flatMap(item => item.outcomes.flatMap(outcome => outcome.evidenceNodeIds)),
    ...(design?.disclosures || []).flatMap(item => item.recipients.flatMap(recipient => recipient.revealNodeIds)),
  ]);
}
function npcCanTell(design, npcId, evidenceId, completed, disclosed, nodeById) {
  if (qualityNpcKnowledge(design, npcId, completed, disclosed).has(evidenceId)) return true;
  return nodeById?.get(evidenceId)?.payload?.evidenceKind === 'testimony'
    && (design.npcs?.find(npc => npc.id === npcId)?.beliefs || [])
      .some(item => item.evidenceNodeId === evidenceId && completed.has(item.sourceNodeId));
}
export function qualityRevelationAllowed(design, nodeId, completed, shared, nodeById) {
  return (design?.revelations || []).filter(item => item.nodeId === nodeId).every(item => {
    const disclosed = new Set(shared.disclosures.filter(row => row.npcId === item.npcId).map(row => row.evidenceId));
    const knowledge = qualityNpcKnowledge(design, item.npcId, completed, disclosed);
    return item.requiresEvidenceIds.every(id => knowledge.has(id))
      && item.evidenceIds.every(id => npcCanTell(design, item.npcId, id, completed, disclosed, nodeById));
  });
}
export function qualityMandateAllows(shared, nodeId, memberId, participants) {
  const mandate = Object.hasOwn(shared.delegations, nodeId) ? shared.delegations[nodeId] : null;
  if (!mandate) return true;
  const current = new Set(participants.map(member => member.id));
  return current.has(mandate.delegateAccountId) && mandate.delegateAccountId === memberId
    && participants.every(member => mandate.acknowledgedAccountIds.includes(member.id));
}

export function projectQualityRuntime(design, context, actor, shared, facts) {
  const { instance, accountId, members, visibleNodes, completed, actions, now } = context;
  const known = new Set(visibleNodes.filter(node => node.type === 'evidence' && node.state === 'completed').map(node => node.id));
  const visible = new Set(visibleNodes.map(node => node.id));
  const authorized = new Set(visibleNodes.filter(node => node.state === 'completed').map(node => node.id));
  const participants = members.map(member => ({ id: qualityMemberId(instance.id, member.account_id),
    name: member.name_snapshot, roleId: member.role_id, isMe: member.account_id === accountId }));
  const ownId = qualityMemberId(instance.id, accountId);
  const questions = (design.questions || []).filter(item => visible.has(item.nodeId)
    && qualitySpoilerAllows(design, item.nodeId, authorized));
  const openQuestion = questions.find(item => !completed.has(item.nodeId));
  const study = actor.study;
  return {
    ...projectQuestQuality(design, known), revision: actor.revision,
    participants, questions, currentQuestion: openQuestion?.text || design.question,
    evidence: visibleNodes.filter(node => known.has(node.id)).map(node => ({ id: node.id,
      title: node.title || 'Evidence', text: node.summary || '', ...(node.evidenceKind ? { evidenceKind: node.evidenceKind } : {}) })),
    recap: visibleNodes.filter(node => node.state === 'completed' && node.summary && node.type !== 'terminal')
      .slice(-4).map(node => node.summary),
    draft: actor.draft, motiveId: actor.motiveId,
    firstImpression: actor.firstImpression,
    sharedImpressions: facts.filter(fact => fact.key.startsWith('runtime.quality.actor:'))
      .flatMap(fact => {
        const account = fact.key.slice('runtime.quality.actor:'.length);
        const impression = fact.value?.firstImpression;
        return impression?.shared && members.some(member => member.account_id === account)
          ? [{ accountId: qualityMemberId(instance.id, account), text: impression.text, unsure: impression.unsure }] : [];
      }),
    disclosures: (design.disclosures || []).filter(item => known.has(item.evidenceId)).map(item => ({
      evidenceId: item.evidenceId, recipients: item.recipients.map(({ npcId, label }) => ({ npcId, label })),
    })),
    disclosureReports: shared.disclosures.map(({ evidenceId, npcId, report }) => ({ evidenceId, npcId, report })),
    fieldworkAssignments: (design.fieldworkAssignments || []).map(({ id, title, questions, methods }) => ({ id, title, questions, methods })),
    fieldworkReports: shared.fieldworkReports.map(({ assignmentId, questionId, methodId, report }) => ({ assignmentId, questionId, methodId, report })),
    delegations: Object.entries(shared.delegations).filter(([nodeId]) => !completed.has(nodeId))
      .map(([nodeId, mandate]) => ({ nodeId, delegateAccountId: mandate.delegateAccountId,
        acknowledgedAccountIds: mandate.acknowledgedAccountIds.filter(id => participants.some(member => member.id === id)),
        requiredAccountIds: participants.map(member => member.id) })),
    debrief: { available: instance.status === 'completed', opened: actor.debriefOpened,
      ...(actor.debriefOpened && instance.status === 'completed' ? { text: context.debriefText } : {}) },
    study: { consented: !!study?.consented, evidenceType: study?.evidenceType || 'unspecified',
      familiarity: study?.familiarity || 'new', eligibleAt: study?.eligibleAt || null,
      comprehensionSubmitted: !!study?.comprehension, recallSubmitted: !!study?.recall,
      recallEligible: !!study?.consented && !!study?.comprehension && now >= Date.parse(study.eligibleAt),
      canSubmitComprehension: !!study?.consented && instance.status === 'completed' && !actor.debriefOpened,
      ...(study?.comprehension ? { comprehension: study.comprehension.answers } : {}),
      ...(study?.recall ? { recall: { memory: study.recall.memory, enjoyment: study.recall.enjoyment, understanding: study.recall.understanding } } : {}),
    },
    canDelegate: instance.status === 'active' && participants.length > 1,
    ownMemberId: ownId,
  };
}

const operationFields = {
  save_draft: ['text', 'evidenceIds', 'conclusionId'], set_motive: ['motiveId'],
  first_impression: ['text', 'unsure', 'share'], disclose: ['evidenceId', 'npcId'],
  fieldwork: ['assignmentId', 'questionId', 'methodId'],
  propose_mandate: ['nodeId', 'delegateAccountId'], acknowledge_mandate: ['nodeId'], clear_mandate: ['nodeId'],
  open_debrief: [], study_consent: ['consent', 'evidenceType', 'familiarity'],
  study_comprehension: ['answers'], study_recall: ['memory', 'enjoyment', 'understanding'],
};
export function applyQualityOperation(design, context, oldActor, oldShared, input) {
  const actor = structuredClone(oldActor), shared = structuredClone(oldShared);
  const { instance, accountId, members, knownEvidence, actions, completed, now } = context;
  const fields = operationFields[input?.operation];
  if (!fields || Object.keys(input).some(key => !['expectedRevision', 'expectedQualityRevision', 'operation', ...fields].includes(key))) {
    reject('bad_request', 'Choose one supported case-file operation and its declared fields.');
  }
  if (!Number.isInteger(input.expectedQualityRevision) || input.expectedQualityRevision !== actor.revision) {
    reject('stale_quality', 'Your private case file changed. Refresh before saving.');
  }
  const memberId = qualityMemberId(instance.id, accountId);
  const participants = members.map(member => ({ id: qualityMemberId(instance.id, member.account_id), ...member }));
  let publicChange = false;
  const revealNodeIds = [];
  const requireActive = () => { if (instance.status !== 'active') reject('case_closed', 'That operation needs an active case.'); };
  const known = id => { if (!knownEvidence.has(id)) reject('unknown_evidence', 'Choose evidence already revealed to you.'); };
  const mandateFor = () => {
    const mandate = Object.hasOwn(shared.delegations, input.nodeId) ? shared.delegations[input.nodeId] : null;
    if (!mandate) reject('unknown_mandate', 'No current decision mandate exists for that scene.');
    return mandate;
  };
  switch (input.operation) {
    case 'save_draft': {
      if (!text(input.text) || !ids(input.evidenceIds)) reject('bad_request', 'Keep the private draft and evidence selection within their bounds.');
      input.evidenceIds.forEach(known);
      if (input.conclusionId !== undefined && !actions.some(action => action.interaction?.conclusions?.some(item => item.id === input.conclusionId))) {
        reject('bad_request', 'Choose a currently offered conclusion.');
      }
      actor.draft = { text: input.text, evidenceIds: input.evidenceIds, ...(input.conclusionId ? { conclusionId: input.conclusionId } : {}) };
      break;
    }
    case 'set_motive':
      if (!(design.motives || []).some(item => item.id === input.motiveId)) reject('bad_request', 'Choose one of this case’s stated motives.');
      actor.motiveId = input.motiveId;
      break;
    case 'first_impression':
      if (!text(input.text, 1000) || typeof input.unsure !== 'boolean' || typeof input.share !== 'boolean') reject('bad_request', 'Record an impression or uncertainty and choose whether to share it.');
      publicChange = input.share || actor.firstImpression.shared;
      actor.firstImpression = { text: input.text, unsure: input.unsure, shared: input.share };
      break;
    case 'disclose': {
      requireActive(); known(input.evidenceId);
      const recipient = (design.disclosures || []).find(item => item.evidenceId === input.evidenceId)
        ?.recipients.find(item => item.npcId === input.npcId);
      if (!recipient) reject('bad_request', 'That recipient is not offered for this evidence.');
      const disclosed = new Set([...shared.disclosures.filter(item => item.npcId === input.npcId).map(item => item.evidenceId), input.evidenceId]);
      if (recipient.revealNodeIds.some(id => !npcCanTell(design, input.npcId, id, completed, disclosed, context.nodeById))) {
        reject('npc_knowledge', 'The recipient does not have a justified source for that response.');
      }
      if (!shared.disclosures.some(item => item.evidenceId === input.evidenceId && item.npcId === input.npcId)) {
        shared.disclosures.push({ evidenceId: input.evidenceId, npcId: input.npcId, report: recipient.report });
        revealNodeIds.push(...recipient.revealNodeIds); publicChange = true;
      }
      break;
    }
    case 'fieldwork': {
      requireActive();
      const assignment = (design.fieldworkAssignments || []).find(item => item.id === input.assignmentId);
      const outcome = assignment?.outcomes.find(item => item.questionId === input.questionId && item.methodId === input.methodId);
      if (!outcome) reject('bad_request', 'Assign an offered question and a bounded method.');
      if (!shared.fieldworkReports.some(item => item.assignmentId === input.assignmentId && item.questionId === input.questionId && item.methodId === input.methodId)) {
        if (shared.fieldworkReports.length >= 64) reject('case_limit', 'The fieldwork report limit has been reached.');
        shared.fieldworkReports.push({ assignmentId: input.assignmentId, questionId: input.questionId,
          methodId: input.methodId, report: outcome.report });
        revealNodeIds.push(...outcome.evidenceNodeIds); publicChange = true;
      }
      break;
    }
    case 'propose_mandate': {
      requireActive();
      const action = actions.find(item => item.nodeId === input.nodeId && item.kind === 'choose');
      const delegate = participants.find(member => member.id === input.delegateAccountId);
      if (!action || !delegate || participants.length < 2) reject('bad_request', 'Choose a current participant and an available decision scene.');
      const node = context.nodeById.get(input.nodeId);
      if ((node.payload.gates || []).some(gate => gate.kind === 'party_role' && gate.role !== delegate.role_id)) {
        reject('content_gate', 'Delegation cannot bypass the scene’s original role requirement.');
      }
      const old = Object.hasOwn(shared.delegations, input.nodeId) ? shared.delegations[input.nodeId] : null;
      if (old && old.proposerMemberId !== memberId) reject('mandate_pending', 'A current proposal must be acknowledged or withdrawn by its proposer.');
      shared.delegations = { ...shared.delegations, [input.nodeId]: { delegateAccountId: input.delegateAccountId,
        proposerMemberId: memberId, acknowledgedAccountIds: [memberId] } }; publicChange = true;
      break;
    }
    case 'acknowledge_mandate': {
      requireActive(); const mandate = mandateFor();
      if (!participants.some(member => member.id === mandate.delegateAccountId)) reject('unknown_mandate', 'The proposed delegate has left. Withdraw this proposal.');
      if (!mandate.acknowledgedAccountIds.includes(memberId)) { mandate.acknowledgedAccountIds.push(memberId); publicChange = true; }
      break;
    }
    case 'clear_mandate': {
      requireActive(); const mandate = mandateFor();
      if (mandate.proposerMemberId !== memberId && participants.some(member => member.id === mandate.proposerMemberId)
        && participants.some(member => member.id === mandate.delegateAccountId)) reject('not_proposer', 'Only the current proposer can withdraw this proposal. You can leave the case safely.');
      delete shared.delegations[input.nodeId]; publicChange = true; break;
    }
    case 'open_debrief':
      if (instance.status !== 'completed') reject('case_active', 'The debrief becomes available when the case is closed.');
      actor.debriefOpened = true; break;
    case 'study_consent': {
      if (typeof input.consent !== 'boolean' || !['self_reported_human', 'ai', 'unspecified'].includes(input.evidenceType)
        || !['new', 'familiar'].includes(input.familiarity)) reject('bad_request', 'Choose consent, familiarity and the evidence type for this study.');
      if (input.consent && input.evidenceType === 'self_reported_human'
        && members.find(member => member.account_id === accountId)?.participant_kind === 'agent') {
        reject('study_evidence_type', 'An agent account must label its study session as automated or unspecified.');
      }
      if (!input.consent) actor.study = null;
      else if (actor.debriefOpened || instance.status === 'completed') reject('study_started', 'Enroll before completing the case or opening its debrief.');
      else if (!actor.study) actor.study = { consented: true, evidenceType: input.evidenceType,
        familiarity: input.familiarity, consentedAt: new Date(now).toISOString(), eligibleAt: null };
      break;
    }
    case 'study_comprehension': {
      if (!actor.study?.consented || instance.status !== 'completed' || actor.debriefOpened || actor.study.comprehension) reject('study_unavailable', 'Submit the blind comprehension response once, after completing the case and before opening the debrief.');
      if (!input.answers || Object.keys(input.answers).sort().join(',') !== 'next,what,why'
        || !Object.values(input.answers).every(value => text(value) && value.trim())) reject('bad_request', 'Answer what happened, why, and what you would do next.');
      actor.study.comprehension = { answers: input.answers, submittedAt: new Date(now).toISOString() };
      actor.study.eligibleAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      break;
    }
    case 'study_recall': {
      if (!actor.study?.consented || !actor.study.comprehension || actor.study.recall
        || now < Date.parse(actor.study.eligibleAt)) reject('study_not_due', 'Delayed recall opens at least 24 hours after the comprehension response.');
      if (!text(input.memory) || !input.memory.trim() || ![input.enjoyment, input.understanding].every(value => Number.isInteger(value) && value >= 1 && value <= 5)) reject('bad_request', 'Record unaided recall and ratings from one to five.');
      actor.study.recall = { memory: input.memory, enjoyment: input.enjoyment, understanding: input.understanding,
        submittedAt: new Date(now).toISOString() }; break;
    }
  }
  actor.revision += 1;
  return { actor, shared, publicChange, revealNodeIds: [...new Set(revealNodeIds)] };
}
