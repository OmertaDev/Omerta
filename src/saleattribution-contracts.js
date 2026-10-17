const text = { type: 'string', pattern: '^[!-~]{1,128}$', maxLength: 128 };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const quote = { campaignId: text, sourceHash: digest, consignmentId: text, consignmentHash: digest,
  commissionCash: integer(1, 1000000), expiresAt: { type: 'string', format: 'date-time' },
  state: { enum: ['offered', 'active', 'paid', 'cancelled', 'expired', 'party_dead'] } };
const attribution = { attributionId: text, sourceHash: digest, campaignId: text, campaignHash: digest,
  createdAt: { type: 'string', format: 'date-time' } };
const reference = object({ campaignId: text, sourceHash: digest, consent: { const: true } });
const key = { name: 'Idempotency-Key', in: 'header', required: true, schema: text };
export const SALE_ATTRIBUTION_SCHEMAS = {
  SaleAttributionBoard: object({ observedAt: { type: 'string', format: 'date-time' },
    rows: { type: 'array', maxItems: 25, items: object({ ...quote, available: { type: 'boolean' }, reservedCash: integer(0, 1000000) }, [...Object.keys(quote), 'available']) },
    next: { anyOf: [text, { type: 'null' }] } }),
  SaleAttributionResult: { oneOf: [
    object({ ok: { const: true }, ...quote, state: { const: 'offered' }, reserveJournal: text }),
    object({ ok: { const: true }, ...quote, state: { const: 'active' } }),
    object({ ok: { const: true }, ...attribution }),
    object({ ok: { const: true }, ...quote, state: { enum: ['cancelled', 'expired', 'party_dead'] }, refundedCash: integer(1, 1000000), refundJournal: text }),
    object({ ok: { const: true }, ...quote, state: { const: 'paid' }, attributionId: text, commissionJournal: text,
      sale: { $ref: '#/components/schemas/ConsignmentResult' } }),
  ] },
};
const action = (operationId, requestSchema) => ({ operationId, requestSchema, requestParameters: [key], responseSchema: { $ref: '#/components/schemas/SaleAttributionResult' } });
export const SALE_ATTRIBUTION_CONTRACTS = {
  'GET /v1/sale-attribution': { operationId: 'getSaleAttribution', responseSchema: { $ref: '#/components/schemas/SaleAttributionBoard' },
    requestParameters: [{ name: 'after', in: 'query', required: false, schema: text }] },
  'POST /v1/sale-attribution/open': action('openSaleAttribution', object({ consignmentId: text, sourceHash: digest, publisherAccountId: text,
    commissionCash: integer(1, 1000000), lifetimeSeconds: integer(60, 86400), consent: { const: true } })),
  'POST /v1/sale-attribution/accept': action('acceptSaleAttribution', reference),
  'POST /v1/sale-attribution/attribute': action('recordSaleAttribution', reference),
  'POST /v1/sale-attribution/buy': action('buyAttributedConsignment', object({ attributionId: text, sourceHash: digest, consent: { const: true } })),
  'POST /v1/sale-attribution/cancel': action('cancelSaleAttribution', reference),
  'POST /v1/sale-attribution/expire': action('expireSaleAttribution', reference),
};
