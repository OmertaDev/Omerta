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
