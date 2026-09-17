// Shared, data-only contract for a fact learned from a pinned discovery source.
// This describes a requirement, never grants knowledge or client authority.
import { GameError } from './game.js';
import { canonicalBytes } from './content/canonical.js';

const fail = () => { throw new GameError('bad_knowledge_requirement', 'Invalid knowledge requirement.'); };
export function normalizeKnowledgeRequirement(input) {
  const fields = ['contentHash', 'domain', 'proposition', 'sourceRoot', 'value'];
  const plain = (value, keys) => {
    if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== keys.length
      || keys.some((key) => !Object.hasOwn(value, key))
      || Reflect.ownKeys(value).some((key) => !keys.includes(key)
        || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
        || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail();
  };
  plain(input, fields);
  if (typeof input.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.contentHash)) fail();
  for (const key of ['domain', 'proposition', 'sourceRoot']) {
    if (typeof input[key] !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(input[key])) fail();
  }
  plain(input.value, ['type', 'value']);
  const { type, value } = input.value;
  if (!(type === 'boolean' && typeof value === 'boolean')
    && !(type === 'integer' && Number.isSafeInteger(value) && !Object.is(value, -0))
    && !(type === 'text' && typeof value === 'string' && value.length > 0 && value.length <= 500)) fail();
  try { canonicalBytes(input); } catch { fail(); }
  return Object.freeze({ contentHash: input.contentHash, domain: input.domain,
    proposition: input.proposition, sourceRoot: input.sourceRoot,
    value: Object.freeze({ type, value }) });
}

export const knowledgeRequirementKey = (input) => canonicalBytes(normalizeKnowledgeRequirement(input)).toString('utf8');

// A prerequisite over domain history; this does not issue a coordination knowledge claim.
export function normalizeOperationOutcomeRequirement(input) {
  const fields = ['definitionId', 'definitionHash', 'outcome'];
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    || Reflect.ownKeys(input).length !== fields.length
    || fields.some((key) => !Object.hasOwn(input, key)
      || !Object.getOwnPropertyDescriptor(input, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(input, key), 'value'))
    || typeof input.definitionId !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(input.definitionId)
    || typeof input.definitionHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.definitionHash)
    || !['completed', 'failed'].includes(input.outcome)) {
    throw new GameError('bad_operation_outcome_requirement', 'Invalid pinned operation outcome requirement.');
  }
  return Object.freeze({ definitionId: input.definitionId, definitionHash: input.definitionHash, outcome: input.outcome });
}

// External predicates describe existing domain authority; they never create learned facts.
export function normalizeWorldPrerequisite(input) {
  const invalid = () => { throw new GameError('bad_world_prerequisite', 'Invalid world prerequisite.'); };
  const record = (value, fields) => {
    if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== fields.length
      || fields.some((field) => { const descriptor = Object.getOwnPropertyDescriptor(value, field);
        return !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value'); })) invalid();
  };
  const id = (value) => { if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) invalid(); return value; };
  const hash = (value) => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalid(); return value; };
  record(input, ['adapter', 'requirement']);
  const { adapter, requirement: value } = input;
  let requirement;
  if (adapter === 'family_operation_outcome') requirement = normalizeOperationOutcomeRequirement(value);
  else if (adapter === 'mystery_state') {
    record(value, ['graphId', 'graphVersion', 'definitionHash', 'nodeId', 'ownerScope', 'state']);
    if (!Number.isSafeInteger(value.graphVersion) || value.graphVersion < 1 || value.graphVersion > 2147483647
      || !['account', 'current_character'].includes(value.ownerScope) || value.state !== 'completed') invalid();
    requirement = { graphId: id(value.graphId), graphVersion: value.graphVersion, definitionHash: hash(value.definitionHash),
      nodeId: id(value.nodeId), ownerScope: value.ownerScope, state: 'completed' };
  } else if (adapter === 'social') {
    const descriptor = Object.getOwnPropertyDescriptor(value ?? {}, 'relation');
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
    const relation = descriptor.value;
    if (['same_crew', 'different_crew', 'same_family'].includes(relation)) {
      record(value, ['relation', 'subject']); requirement = { relation, subject: id(value.subject) };
    } else {
      record(value, ['relation']);
      if (!['crew_member', 'family_member', 'family_officer'].includes(relation)) invalid();
      requirement = { relation };
    }
  } else if (adapter === 'world_state') {
    record(value, ['objectId', 'definitionHash', 'state', ...(Object.hasOwn(value ?? {}, 'controller') ? ['controller'] : [])]);
    if (Object.hasOwn(value, 'controller') && value.controller !== 'current_family') invalid();
    requirement = { objectId: id(value.objectId), definitionHash: hash(value.definitionHash), state: id(value.state),
      ...(Object.hasOwn(value, 'controller') ? { controller: value.controller } : {}) };
  } else if (adapter === 'item_ownership') {
    record(value, ['templateId', 'provenance']);
    if (value.provenance !== 'crafted') invalid();
    requirement = { templateId: id(value.templateId), provenance: 'crafted' };
  } else invalid();
  return Object.freeze({ adapter, requirement: Object.freeze(requirement) });
}

export const worldPrerequisiteKey = (value) => canonicalBytes(normalizeWorldPrerequisite(value)).toString('utf8');
