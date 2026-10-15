// Provider framing only. Capability arguments are validated by the Gateway.
export const MUSE_CALL_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['name', 'arguments', 'requestId'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z][a-z0-9_]*$' },
    arguments: { type: 'object', maxProperties: 40 },
    requestId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_-]+$' },
  },
});

export const MUSE_CONTRACTS = Object.freeze({
  'GET /integrations/muse': { operationId: 'getMuseAdapterManifest' },
  'GET /integrations/muse/tools': { operationId: 'listMuseAdapterTools' },
  'POST /integrations/muse/call': { operationId: 'callMuseAdapterTool', requestSchema: MUSE_CALL_SCHEMA },
});

export function validateToolRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)
    || Object.keys(request).some(key => !['name', 'arguments', 'requestId'].includes(key))
    || typeof request.name !== 'string' || !/^[a-z][a-z0-9_]{0,99}$/.test(request.name)
    || typeof request.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(request.requestId)
    || !request.arguments || typeof request.arguments !== 'object' || Array.isArray(request.arguments)
    || Object.keys(request.arguments).length > 40) {
    const error = new Error('Provide a tool name, arguments object, and unique requestId.');
    error.code = 'invalid_tool_request';
    error.statusCode = 400;
    throw error;
  }
}
