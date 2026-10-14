// Machine-readable transport contracts; capability argument schemas share the live registry.
import { CAPABILITIES } from './capabilities.js';
import { connectionInput, identifier, object } from './security.js';

const error = (description) => ({ description,
  content: { 'application/json': { schema: object({ error: { type: 'string' } }, ['error']) } } });
const responses = {
  400: error('Invalid closed-schema input; no coercion or unknown fields.'),
  401: error('Missing, invalid, expired or revoked credential.'),
  403: error('Missing scope, wrong provider or player approval required.'),
  404: error('Capability or player-visible entity unavailable.'),
  409: error('Changed request ID, stale or expired proposal, or unavailable action.'),
  429: { ...error('Shared player cadence exceeded.'), headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Retry delay in seconds.' } } },
  503: error('Authoritative service temporarily unavailable; no internal data returned.'),
};
const contract = (operationId, requestSchema, extra = {}) => ({ operationId,
  ...(requestSchema ? { requestSchema } : {}), extraResponses: responses, ...extra });
const callSchema = { oneOf: CAPABILITIES.map((capability) => object({
  capability: { type: 'string', const: capability.name }, arguments: capability.inputSchema, requestId: identifier,
}, ['capability', 'arguments', 'requestId'])) };
const eventParams = [
  { name: 'subscriptionId', in: 'query', required: true, schema: identifier },
  { name: 'after', in: 'query', schema: { type: 'string', maxLength: 3000, pattern: '^[A-Za-z0-9_-]+$' } },
];
export const GATEWAY_CONTRACTS = Object.freeze({
  'POST /v1/gateway/call': contract('callAgentCapability', callSchema),
  'GET /v1/gateway/capabilities': contract('listAgentCapabilities'),
  'GET /v1/gateway/scopes': contract('listDelegationScopes'),
  'POST /v1/gateway/connections': contract('createAgentConnection', connectionInput),
  'GET /v1/gateway/connections': contract('listAgentConnections'),
  'DELETE /v1/gateway/connections/:id': contract('revokeAgentConnection'),
  'GET /v1/gateway/preparations/:id': contract('reviewAgentPreparation'),
  'POST /v1/gateway/preparations/:id/confirm': contract('confirmAgentPreparation', object({
    nonce: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
    digest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  }, ['nonce', 'digest'])),
  'GET /v1/gateway/activity': contract('listAgentActivity'),
  'GET /v1/gateway/events/catalog': contract('listAgentEventTopics'),
  'GET /v1/gateway/events': contract('getAgentEvents', undefined, { requestParameters: [...eventParams,
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }] }),
  'GET /v1/gateway/events/stream': contract('streamAgentEvents', undefined, { requestParameters: [...eventParams,
    { name: 'Last-Event-ID', in: 'header', schema: { type: 'string', maxLength: 3000 } }] }),
  'GET /v1/gateway/subscriptions': contract('listAgentSubscriptions'),
  'POST /v1/gateway/subscriptions': contract('createAgentSubscription', object({ topics: {
    type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: { type: 'string', maxLength: 80 },
  } }, ['topics'])),
  'DELETE /v1/gateway/subscriptions/:id': contract('deleteAgentSubscription'),
});
