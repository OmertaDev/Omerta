// Closed, server-authored recipe policy shared by validation and execution.
import { normalizeKnowledgeRequirement, normalizeWorldPrerequisite } from './world-knowledge.js';

const MODES = new Set(['public', 'known', 'partial', 'secret', 'crew', 'family', 'mystery_unlocked']);
const SCOPES = new Set(['account', 'global', 'territory']);
const PERIODS = new Set(['lifetime', 'day', 'week', 'season']);
const invalid = () => { throw Object.assign(new Error('Invalid recipe discovery or scarcity policy.'), { code: 'bad_recipe_policy' }); };
function closed(value, fields) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== fields.length || fields.some((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      return !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value');
    })) invalid();
}
function list(value, maximum) {
  if (!Array.isArray(value) || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
  }
  return value;
}
export function normalizeRecipeRequirement(value) {
  closed(value, ['adapter', 'requirement']);
  if (value.adapter === 'knowledge') return Object.freeze({ adapter: 'knowledge', requirement: normalizeKnowledgeRequirement(value.requirement) });
  const normalized = normalizeWorldPrerequisite(value);
  // Solo crafting never resolves a caller-selected second actor.
  if (normalized.adapter === 'social' && normalized.requirement.subject !== undefined) invalid();
  return normalized;
}
export function normalizeRecipePolicy(node) {
  const raw = node.discovery === undefined ? { mode: 'public', requirements: [] } : node.discovery;
  closed(raw, ['mode', 'requirements']);
  if (!MODES.has(raw.mode)) invalid();
  const requirements = list(raw.requirements, 8).map(normalizeRecipeRequirement);
  if (raw.mode === 'public' && requirements.length) invalid();
  if (['known', 'partial', 'secret', 'mystery_unlocked'].includes(raw.mode) && !requirements.length) invalid();
  if (raw.mode === 'mystery_unlocked' && !requirements.some((r) => r.adapter === 'mystery_state')) invalid();
  if (raw.mode === 'crew' || raw.mode === 'family') requirements.push(normalizeRecipeRequirement({ adapter: 'social',
    requirement: { relation: raw.mode === 'crew' ? 'crew_member' : 'family_member' } }));
  const scarcity = node.scarcity === undefined ? { caps: [] } : node.scarcity;
  closed(scarcity, ['caps']);
  const seen = new Set();
  const caps = list(scarcity.caps, 4).map((entry) => {
    closed(entry, ['scope', 'period', 'limit']);
    if (!SCOPES.has(entry.scope) || !PERIODS.has(entry.period) || !Number.isInteger(entry.limit) || entry.limit < 1 || entry.limit > 1000000) invalid();
    const key = `${entry.scope}:${entry.period}`;
    if (seen.has(key)) invalid(); seen.add(key);
    return Object.freeze({ scope: entry.scope, period: entry.period, limit: entry.limit });
  }).sort((a, b) => `${a.scope}:${a.period}`.localeCompare(`${b.scope}:${b.period}`));
  return Object.freeze({ discovery: Object.freeze({ mode: raw.mode, requirements: Object.freeze(requirements) }),
    scarcity: Object.freeze({ caps: Object.freeze(caps) }) });
}
