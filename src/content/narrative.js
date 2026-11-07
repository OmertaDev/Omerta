import crypto from 'node:crypto';

export const NARRATIVE_VERIFIERS = Object.freeze(['ordered_ids', 'unordered_ids', 'mapping']);
export const INTERACTION_KINDS = Object.freeze([
  'deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory',
]);
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const only = (value, keys) => record(value) && Object.keys(value).every((key) => keys.includes(key));
const id = (value) => typeof value === 'string' && value.length <= 160 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
const ids = (value) => Array.isArray(value) && value.length > 0 && value.length <= 64
  && value.every(id) && new Set(value).size === value.length;
const text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;

export function validateNarrativeAnswer(spec, owner) {
  const payload = spec.payload || {};
  if (!NARRATIVE_VERIFIERS.includes(payload.verifier)) return;
  if (!only(payload, ['verifier', 'solution'])) throw new Error(`${owner} answer spec has unknown fields`);
  if (payload.verifier === 'mapping') {
    if (!record(payload.solution) || !ids(Object.keys(payload.solution))
      || !Object.values(payload.solution).every(id)) throw new Error(`${owner} requires a bounded mapping solution`);
  } else if (!ids(payload.solution)) throw new Error(`${owner} requires unique ordered solution IDs`);
}

function validateInteraction(interaction, spec, owner) {
  if (!only(interaction, ['kind', 'items', 'slots']) || !INTERACTION_KINDS.includes(interaction.kind)) {
    throw new Error(`${owner} requires a supported narrative interaction`);
  }
  const entries = (values, label) => {
    if (!Array.isArray(values) || !ids(values.map((entry) => entry?.id))
      || values.some((entry) => !only(entry, ['id', 'label', 'description'])
        || !text(entry.label) || (entry.description !== undefined && !text(entry.description)))) {
      throw new Error(`${owner} requires bounded ${label} with unique IDs and labels`);
    }
    return new Set(values.map((entry) => entry.id));
  };
  const items = entries(interaction.items, 'items');
  if (!NARRATIVE_VERIFIERS.includes(spec?.payload?.verifier)) {
    throw new Error(`${owner} interaction requires a structured answer verifier`);
  }
  if (spec.payload.verifier === 'mapping') {
    const slots = entries(interaction.slots, 'slots');
    if (slots.size !== Object.keys(spec.payload.solution).length
      || Object.entries(spec.payload.solution).some(([slot, item]) => !slots.has(slot) || !items.has(item))) {
      throw new Error(`${owner} solution must name every public slot and only public items`);
    }
  } else {
    if (interaction.slots !== undefined) throw new Error(`${owner} slots require a mapping verifier`);
    if (spec.payload.solution.some((item) => !items.has(item))) {
      throw new Error(`${owner} solution references an unknown public item`);
    }
  }
}

export function validateNarrativePuzzle(node, nodeById, profileIds) {
  const payload = node.payload || {};
  const check = (value, owner) => {
    const spec = nodeById.get(value.answerSpecId);
    if (!spec || spec.type !== 'answer_spec' || !profileIds.has(spec.id)) {
      throw new Error(`${owner} requires a profiled answer spec`);
    }
    if (NARRATIVE_VERIFIERS.includes(spec.payload?.verifier)) {
      validateNarrativeAnswer(spec, owner);
      validateInteraction(value.interaction, spec, owner);
    } else if (value.interaction !== undefined) validateInteraction(value.interaction, spec, owner);
    if (value.hints !== undefined && (!Array.isArray(value.hints) || value.hints.length > 8
      || value.hints.some((hint) => !text(hint)))) throw new Error(`${owner} hints must be bounded text`);
  };
  check(payload, `runtime puzzle ${node.id}`);
  if (payload.variants !== undefined) {
    if (!Array.isArray(payload.variants) || payload.variants.length < 2 || payload.variants.length > 16
      || !ids(payload.variants.map((variant) => variant?.id))) throw new Error(`runtime puzzle ${node.id} requires 2-16 unique variants`);
    for (const variant of payload.variants) {
      if (!only(variant, ['id', 'prompt', 'interaction', 'answerSpecId', 'hints']) || !text(variant.prompt)) {
        throw new Error(`runtime puzzle ${node.id} has malformed variant`);
      }
      check(variant, `runtime puzzle ${node.id} variant ${variant.id}`);
    }
  }
  if (payload.suspicion !== undefined && (!only(payload.suspicion, ['onWrong', 'max'])
    || !Number.isInteger(payload.suspicion.onWrong) || payload.suspicion.onWrong < 1 || payload.suspicion.onWrong > 10
    || !Number.isInteger(payload.suspicion.max) || payload.suspicion.max < 1 || payload.suspicion.max > 100
    || !payload.failForward)) throw new Error(`runtime puzzle ${node.id} suspicion requires bounded pressure and a fail-forward route`);
  if (payload.failForward !== undefined && (!only(payload.failForward, ['afterAttempts', 'nextNodeId', 'summary'])
    || !Number.isInteger(payload.failForward.afterAttempts) || payload.failForward.afterAttempts < 1
    || payload.failForward.afterAttempts > 20 || !text(payload.failForward.summary)
    || !profileIds.has(payload.failForward.nextNodeId))) throw new Error(`runtime puzzle ${node.id} has malformed fail-forward policy`);
}

export function narrativeVariant(node, instanceId) {
  const variants = node.payload.variants;
  if (!variants?.length) return node.payload;
  const hash = crypto.createHash('sha256').update(`${instanceId}\0${node.id}`).digest();
  return { ...node.payload, ...variants[hash.readUInt32BE(0) % variants.length] };
}

export function verifyNarrativeSubmission(spec, interaction, submission) {
  const verifier = spec.payload.verifier;
  const items = new Set(interaction.items.map((entry) => entry.id));
  if (verifier === 'mapping') {
    if (!only(submission, ['assignments']) || !record(submission.assignments)) return { valid: false };
    const slots = new Set(interaction.slots.map((entry) => entry.id));
    const entries = Object.entries(submission.assignments);
    if (entries.length !== slots.size || entries.some(([slot, item]) => !slots.has(slot) || !items.has(item))) return { valid: false };
    return { valid: true, matched: entries.every(([slot, item]) => spec.payload.solution[slot] === item) };
  }
  if (!only(submission, ['ids']) || !ids(submission.ids) || submission.ids.some((value) => !items.has(value))) return { valid: false };
  const expected = spec.payload.solution;
  return { valid: true, matched: submission.ids.length === expected.length
    && (verifier === 'ordered_ids'
      ? submission.ids.every((value, index) => value === expected[index])
      : submission.ids.every((value) => expected.includes(value))) };
}

export function narrativeBranchAllows(node, result, targetId) {
  if (node?.type === 'choice') {
    const option = node.payload.options.find((entry) => entry.id === result.choiceId);
    return !option?.nextNodeIds || option.nextNodeIds.includes(targetId);
  }
  if (node?.type === 'puzzle') {
    if (result.outcome === 'complication' && node.payload.failForward) return node.payload.failForward.nextNodeId === targetId;
    return node.payload.successNextNodeIds ? node.payload.successNextNodeIds.includes(targetId)
      : node.payload.failForward?.nextNodeId !== targetId;
  }
  return true;
}
