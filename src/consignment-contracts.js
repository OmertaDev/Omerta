const text = { type: 'string', pattern: '^[!-~]{1,128}$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const quote = {
  consignmentId: text, sourceHash: digest, price: integer(1, 1000000), hostFeeBps: integer(0, 2000),
  expiresAt: { type: 'string', format: 'date-time' },
  status: { enum: ['offered', 'active', 'sold', 'cancelled', 'expired', 'party_dead'] },
};
const reference = object({ consignmentId: text, sourceHash: digest, consent: { const: true } });
const create = object({ itemId: text, hostAccountId: text, price: integer(1, 1000000),
  hostFeeBps: integer(0, 2000), lifetimeSeconds: integer(60, 86400), consent: { const: true } });
export const CONSIGNMENT_SCHEMAS = {
  ConsignmentBoard: object({ observedAt: { type: 'string', format: 'date-time' },
    rows: { type: 'array', maxItems: 25, items: object({ ...quote, available: { type: 'boolean' },
      pickupDistrict: { anyOf: [{ type: 'string', maxLength: 80 }, { type: 'null' }] },
      itemId: text, originalOwner: text, originalHost: text }, [...Object.keys(quote), 'available', 'pickupDistrict']) },
    next: { anyOf: [text, { type: 'null' }] } }),
  ConsignmentResult: { oneOf: [object({ ok: { const: true }, ...quote,
      status: { enum: ['offered', 'active', 'cancelled', 'expired', 'party_dead'] } }),
    object({ ok: { const: true }, ...quote, status: { const: 'sold' }, itemId: text, paid: integer(1, 1000000),
      hostFee: integer(0, 200000), condition: integer(10, 150),
      transactionIds: { type: 'array', minItems: 3, maxItems: 3, uniqueItems: true, items: text } })] },
};
const key = { name: 'Idempotency-Key', in: 'header', required: true, schema: text };
const action = (name, requestSchema) => ({ operationId: name, requestSchema,
  requestParameters: [key], responseSchema: { $ref: '#/components/schemas/ConsignmentResult' } });
export const CONSIGNMENT_CONTRACTS = {
  'GET /v1/consignments': { operationId: 'getConsignments', responseSchema: { $ref: '#/components/schemas/ConsignmentBoard' },
    requestParameters: [{ name: 'after', in: 'query', required: false, schema: text }] },
  'POST /v1/consignments/create': action('createConsignment', create),
  'POST /v1/consignments/accept': action('acceptConsignment', reference),
  'POST /v1/consignments/buy': action('buyConsignment', reference),
  'POST /v1/consignments/cancel': action('cancelConsignment', reference),
  'POST /v1/consignments/expire': action('expireConsignment', reference),
};
