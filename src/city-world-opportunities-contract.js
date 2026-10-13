// Closed server contracts for generation-bound, nonfinancial neighborhood opportunities.
import { GameError } from './game.js';
import { DISTRICTS } from './rules.js';
import { assertItemRead, assertItemTransaction } from './items.js';
import * as adapters from './city-world-opportunity-adapters.js';

const NPC_AUTHORITIES = new WeakSet();
const fail = (code = 'bad_city_opportunity') => { throw new GameError(code, 'Refresh the neighborhood and use a current issued opportunity.'); };
const record = (value, required, optional = []) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).some(key => ![...required, ...optional].includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))
    || required.some(key => !Object.hasOwn(value, key))) fail();
};
const identifier = value => typeof value === 'string' && /^[\x21-\x7e]{1,200}$/.test(value);
const generation = value => Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
const district = value => DISTRICTS.some(entry => entry.id === value);
export const CITY_WORLD_MAX_HEAT_RAISE = adapters.CITY_WORLD_MAX_HEAT_RAISE;
export const CITY_WORLD_OPPORTUNITY_NPC_LIMIT = 12;
export const CITY_NPC_FAVOR_TIERS = Object.freeze(['stranger', 'familiar', 'trusted', 'ally']);

const nativeAdapter = (name, ...args) => {
  try { return adapters[name](...args); } catch (error) { throw new GameError(error.code || 'bad_mystery_condition', error.message); }
};
export const normalizeCityOpportunityCondition = value => nativeAdapter('normalizeCityOpportunityCondition', value);
export const normalizeCityOpportunityEffect = value => nativeAdapter('normalizeCityOpportunityEffect', value);
export const cityRecurringWindow = (nowMs, input) => nativeAdapter('cityRecurringWindow', nowMs, input);
export const cityRaisedHeat = (current, input) => nativeAdapter('cityRaisedHeat', current, input);

// A route creates this only after canonical database reads. Every mutation rechecks the pair
// under sorted character locks inside the existing native receipt callback.
export function createCityNpcAuthority(client, value) {
  try { assertItemRead(client); } catch { assertItemTransaction(client); }
  record(value, ['accountId', 'characterId', 'generation', 'district', 'npcCharacterId', 'npcGeneration']);
  if (!identifier(value.accountId) || !identifier(value.characterId) || !identifier(value.npcCharacterId)
    || value.characterId === value.npcCharacterId || !generation(value.generation)
    || !generation(value.npcGeneration) || !district(value.district)) fail();
  const authority = Object.freeze({ ...value });
  NPC_AUTHORITIES.add(authority);
  return authority;
}

export function assertCityNpcAuthority(value, accountId) {
  if (!NPC_AUTHORITIES.has(value) || value.accountId !== accountId) fail('city_npc_context_required');
  return value;
}

const freshness = ['characterId', 'generation', 'district', 'npcCharacterId', 'npcGeneration'];
const extras = Object.freeze({ start: [], explore: [], complete: ['interactionId'], choice: ['optionId', 'interactionId'], cancel: ['instanceId'] });
export function validateCityOpportunityBody(kind, value) {
  const fields = extras[kind];
  if (!fields) fail();
  record(value, [...freshness, ...(kind === 'choice' ? ['optionId'] : kind === 'cancel' ? ['instanceId'] : [])],
    kind === 'complete' || kind === 'choice' ? ['interactionId'] : []);
  if (!identifier(value.characterId) || !identifier(value.npcCharacterId)
    || value.characterId === value.npcCharacterId || !generation(value.generation)
    || !generation(value.npcGeneration) || !district(value.district)
    || fields.some(key => value[key] !== undefined && !identifier(value[key]))) fail();
  return value;
}

const frozen = value => {
  if (value && typeof value === 'object') { for (const entry of Object.values(value)) frozen(entry); Object.freeze(value); }
  return value;
};
const text = (maximum = 200) => ({ type: 'string', minLength: 1, maxLength: maximum });
const integer = (maximum = 2147483647, minimum = 1) => ({ type: 'integer', minimum, maximum });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const array = (items, maximum) => ({ type: 'array', items, maxItems: maximum });
const id = text(), gen = integer(), location = { type: 'string', enum: DISTRICTS.map(entry => entry.id) };
const freshProperties = { characterId: id, generation: gen, district: location, npcCharacterId: id, npcGeneration: gen };
export const CITY_WORLD_OPPORTUNITY_REQUEST_SCHEMAS = frozen(Object.fromEntries(Object.entries(extras).map(([kind, fields]) => [kind,
  object({ ...freshProperties, ...Object.fromEntries(fields.map(key => [key, id])) },
    [...freshness, ...(kind === 'choice' ? ['optionId'] : kind === 'cancel' ? ['instanceId'] : [])]),
])));
const viewer = object({ characterId: id, generation: gen, district: location });
const npc = object({ id, generation: gen, name: text(80), district: location });
const favor = integer(3, 0), tier = { type: 'string', enum: CITY_NPC_FAVOR_TIERS };
const blocker = object({ code: text(80), message: text(240) });
const blockers = array(blocker, 24);
const graphRef = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const action = object({ id: text(600), label: text(180), method: { const: 'POST' }, path: text(900),
  body: { anyOf: Object.values(CITY_WORLD_OPPORTUNITY_REQUEST_SCHEMAS) }, available: { type: 'boolean' }, blockedBy: blockers,
  consequence: { type: 'string', maxLength: 500 } }, ['id', 'label', 'method', 'path', 'body', 'available', 'blockedBy']);
const opportunity = object({ npcId: id, graphRef, title: text(180), description: text(1200), district: location,
  event: { type: 'boolean' }, available: { type: 'boolean' }, blockedBy: blockers });
export const CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA = frozen(object({ viewer, serverTime: text(40),
  npcs: array(object({ ...npc.properties, favor, tier }), CITY_WORLD_OPPORTUNITY_NPC_LIMIT),
  opportunities: array(opportunity, 108) }));
const node = object({ id, type: text(60), title: text(180), description: { type: 'string', maxLength: 2000 },
  dialogue: { type: 'string', maxLength: 2000 }, status: text(40), available: { type: 'boolean' }, blockedBy: blockers,
  actions: array(action, 16) }, ['id', 'type', 'title', 'status', 'available', 'blockedBy', 'actions']);
const graph = object({ id: graphRef, title: text(180), version: integer(), status: text(40),
  instanceId: id, started: { type: 'boolean' } }, ['id', 'title', 'version', 'status', 'started']);
export const CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA = frozen(object({ viewer, serverTime: text(40), npc,
  relationship: object({ favor, tier }), graph, nodes: array(node, 120), actions: array(action, 4) }));
export const CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA = frozen(object({ ok: { const: true },
  action: { type: 'string', enum: Object.keys(extras) }, instanceId: id, nodeId: id, choiceId: id,
  discovered: array(id, 120), favor: object({ before: favor, after: favor }),
  heat: object({ before: { type: 'number', minimum: 0 }, after: { type: 'number', minimum: 0 } }) },
['ok', 'action', 'instanceId']));
