const text = { type: 'string', pattern: '^[!-~]{1,128}$', maxLength: 128 };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const line = object({ consignmentId: text, sourceHash: digest });
const reference = object({ basketId: text, sourceHash: digest, consent: { const: true } });
const quote = { basketId: text, sourceHash: digest, status: { enum: ['quoted', 'completed', 'cancelled'] }, totalCash: integer(2, 2000000),
  observedAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' },
  lines: { type: 'array', minItems: 2, maxItems: 2, items: object({ consignmentId: text, sourceHash: digest, price: integer(1, 1000000), hostFee: integer(0, 200000) }) } };
export const SHOPPING_BASKET_SCHEMAS = {
  ShoppingBasketBoard: object({ baskets: { type: 'array', maxItems: 25, items: object(quote) } }),
  ShoppingBasketResult: { oneOf: [object({ ok: { const: true }, ...quote, status: { enum: ['quoted', 'cancelled'] } }),
    object({ ok: { const: true }, ...quote, status: { const: 'completed' }, sales: { type: 'array', minItems: 2, maxItems: 2, items: { $ref: '#/components/schemas/ConsignmentResult' } } })] },
};
const key = { name: 'Idempotency-Key', in: 'header', required: true, schema: text };
const action = (operationId, requestSchema) => ({ operationId, requestSchema, requestParameters: [key], responseSchema: { $ref: '#/components/schemas/ShoppingBasketResult' } });
export const SHOPPING_BASKET_CONTRACTS = {
  'GET /v1/items/shopping-baskets': { operationId: 'getShoppingBaskets', responseSchema: { $ref: '#/components/schemas/ShoppingBasketBoard' }, requestParameters: [] },
  'POST /v1/items/shopping-baskets/quote': action('quoteShoppingBasket', object({ lines: { type: 'array', minItems: 2, maxItems: 2, items: line }, consent: { const: true } })),
  'POST /v1/items/shopping-baskets/checkout': action('checkoutShoppingBasket', reference),
  'POST /v1/items/shopping-baskets/cancel': action('cancelShoppingBasket', reference),
};
