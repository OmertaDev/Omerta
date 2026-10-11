// One catalog and closed HTTP contract for free neighborhood presentation and consent.
export const CITY_OUTFITS = Object.freeze([
  { id: 'classic', name: 'Classic', color: '#d5bd91' }, { id: 'moss', name: 'Moss', color: '#9aad80' },
  { id: 'wine', name: 'Wine', color: '#ba8790' }, { id: 'ink', name: 'Ink', color: '#8795ae' },
]);
export const CITY_EMOTES = Object.freeze([
  { id: 'wave', name: 'Wave', text: 'waves' }, { id: 'nod', name: 'Nod', text: 'nods' },
  { id: 'salute', name: 'Salute', text: 'salutes' },
]);
export const CITY_FURNITURE = Object.freeze([
  { id: 'chair', name: 'Chair' }, { id: 'table', name: 'Table' },
  { id: 'lamp', name: 'Lamp' }, { id: 'window', name: 'Window' },
]);
const reference = name => ({ $ref: '#/components/schemas/' + name });
const string = { type: 'string', minLength: 1, maxLength: 200 };
const generation = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const viewer = { characterId: string, generation, district: string };
const outfit = { type: 'string', enum: CITY_OUTFITS.map(item => item.id) };
const emoteId = { type: 'string', enum: CITY_EMOTES.map(item => item.id) };
const blockers = { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['code'], properties: { code: { type: 'string' } } } };
const furnitureItem = { type: 'object', additionalProperties: false, required: ['id', 'x', 'y'], properties: {
  id: { type: 'string', enum: CITY_FURNITURE.map(item => item.id) },
  x: { type: 'integer', minimum: 0, maximum: 5 }, y: { type: 'integer', minimum: 0, maximum: 5 },
  rotation: { type: 'integer', minimum: 0, maximum: 3 },
} };
const room = { type: 'object', additionalProperties: false, required: ['furniture'], properties: {
  furniture: { type: 'array', maxItems: 12, items: furnitureItem },
} };
const preferences = { outfit, chatEnabled: { type: 'boolean', description: 'Consent applies to the last explicitly joined district: off while away, resumed on return until disabled or replaced by joining elsewhere.' }, room };
const text = { type: 'string', minLength: 1, maxLength: 2000,
  description: 'Plain text; the stored and returned message is sanitized and capped at 240 characters.' };
export const CITY_PREFERENCES_BODY = { type: 'object', additionalProperties: false,
  required: Object.keys(viewer), anyOf: Object.keys(preferences).map(key => ({ required: [key] })),
  properties: { ...viewer, ...preferences } };
export const CITY_CHAT_BODY = { type: 'object', additionalProperties: false, required: Object.keys(viewer),
  oneOf: [{ required: ['text'], not: { required: ['emoteId'] } }, { required: ['emoteId'], not: { required: ['text'] } }],
  properties: { ...viewer, text, emoteId } };
export const CITY_SOCIAL_SCHEMAS = {
  CitySocialViewer: { type: 'object', additionalProperties: false, required: Object.keys(viewer), properties: viewer },
  CitySocialPreferences: { type: 'object', additionalProperties: false, required: Object.keys(preferences), properties: preferences },
  CitySocialAction: { type: 'object', additionalProperties: false,
    required: ['id', 'label', 'method', 'path', 'body', 'available', 'blockedBy'], properties: {
      id: string, label: { type: 'string' }, method: { type: 'string', const: 'POST' },
      path: { type: 'string', enum: ['/v1/city/social/preferences', '/v1/city/nearby-chat'] },
      body: { type: 'object', additionalProperties: false, required: Object.keys(viewer), properties: { ...viewer, ...preferences, text, emoteId } },
      available: { type: 'boolean' }, blockedBy: blockers,
      inputFields: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'string', enum: ['room', 'text'] } },
    } },
  CitySocialBoard: { type: 'object', additionalProperties: false,
    required: ['viewer', 'preferences', 'outfits', 'emotes', 'furniture', 'roomSize', 'chat', 'actions'], properties: {
      viewer: reference('CitySocialViewer'), preferences: reference('CitySocialPreferences'),
      outfits: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false,
        required: ['id', 'name', 'color'], properties: { id: outfit, name: { type: 'string' }, color: { type: 'string', pattern: '^#[0-9a-f]{6}$' } } } },
      emotes: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false,
        required: ['id', 'name'], properties: { id: emoteId, name: { type: 'string' } } } },
      furniture: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false,
        required: ['id', 'name'], properties: { id: furnitureItem.properties.id, name: { type: 'string' } } } },
      roomSize: { type: 'object', additionalProperties: false, required: ['width', 'height'], properties: { width: { const: 6 }, height: { const: 6 } } },
      chat: { type: 'object', additionalProperties: false, required: ['readPath', 'available', 'blockedBy'], properties: {
        readPath: { type: 'string', pattern: '^/v1/city/nearby-chat\\?' }, available: { type: 'boolean' }, blockedBy: blockers,
      } },
      actions: { type: 'array', maxItems: 11, items: reference('CitySocialAction') },
    } },
  CitySocialUpdated: { type: 'object', additionalProperties: false, required: ['ok', 'social', 'message', 'viewer', 'preferences'], properties: {
    ok: { const: true }, social: { const: 'updated' }, message: { type: 'string' },
    viewer: reference('CitySocialViewer'), preferences: reference('CitySocialPreferences'),
  } },
  CityNearbyMessage: { type: 'object', additionalProperties: false,
    required: ['id', 'characterId', 'generation', 'who', 'kind', 'text', 'at'], properties: {
      id: string, characterId: string, generation, who: { type: 'string' },
      kind: { type: 'string', enum: ['text', 'emote'] }, text: { type: 'string', minLength: 1, maxLength: 240 },
      emoteId, at: { type: 'string', format: 'date-time' },
    }, oneOf: [{ properties: { kind: { const: 'text' } }, not: { required: ['emoteId'] } },
      { properties: { kind: { const: 'emote' } }, required: ['emoteId'] }] },
  CityNearbyBoard: { type: 'object', additionalProperties: false, required: ['viewer', 'messages', 'participants', 'placement'], properties: {
    viewer: reference('CitySocialViewer'), messages: { type: 'array', maxItems: 50, items: reference('CityNearbyMessage') },
    placement: { const: 'approximate_district' },
    participants: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false,
      required: ['id', 'generation', 'name', 'kind', 'outfit', 'online'], properties: {
        id: string, generation, name: { type: 'string' }, kind: { type: 'string', enum: ['player', 'agent'] }, outfit,
        online: { type: 'boolean' }, emote: { type: 'object', additionalProperties: false, required: ['id', 'at'],
          properties: { id: emoteId, at: { type: 'string', format: 'date-time' } } },
      } } },
  } },
  CityNearbySent: { type: 'object', additionalProperties: false, required: ['ok', 'chat', 'message'], properties: {
    ok: { const: true }, chat: { const: 'sent' }, message: reference('CityNearbyMessage'),
  } },
  CitySocialError: { type: 'object', additionalProperties: false, required: ['error'], properties: {
    error: { type: 'string' }, message: { type: 'string' }, retryAfter: { type: 'integer', minimum: 1 },
  } },
};
const key = { name: 'Idempotency-Key', in: 'header', required: true,
  schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[!-~]+$' } };
const contract = (operationId, response, requestSchema) => ({ operationId, responseSchema: reference(response),
  ...(requestSchema ? { requestSchema, requestBodyRequired: true, requestParameters: [key] } : {}),
  extraResponses: Object.fromEntries([400, 401, 403, 409, 422, 429, 503].map(status => [status,
    { description: 'The neighborhood action is unavailable or stale.', content: { 'application/json': { schema: reference('CitySocialError') } } }])),
});
export const CITY_SOCIAL_CONTRACTS = {
  'GET /v1/city/social': contract('getCitySocial', 'CitySocialBoard'),
  'POST /v1/city/social/preferences': contract('updateCitySocialPreferences', 'CitySocialUpdated', CITY_PREFERENCES_BODY),
  'GET /v1/city/nearby-chat': { ...contract('getNearbyCityChat', 'CityNearbyBoard'), requestParameters: Object.entries(viewer)
    .map(([name, schema]) => ({ name, in: 'query', required: true, schema })) },
  'POST /v1/city/nearby-chat': contract('sendNearbyCityChat', 'CityNearbySent', CITY_CHAT_BODY),
};
