import { M3 } from './rules.js';

export const PROTECTION_CONTRACTS = Object.freeze({
  service: 'canonical_nonexclusive_single_save', maximumCash: 100000,
  minimumSeconds: 60, maximumSeconds: 3600, outstandingPerPayer: 1, acceptedPerGuard: 1,
  payerIsProtectedOriginal: true, gameCashOnly: true,
});
export const PROTECTION_CONTRACT_ACTIONS = Object.freeze(['fund', 'accept', 'activate', 'refund', 'expire', 'withdraw']);
const fail = () => { throw new TypeError('Invalid protection contract terms.'); };
const identity = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail();
  return value;
};
const digest = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
};
const whole = (value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail();
  return value;
};
function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail();
  for (const key of fields) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail();
}
// Pure closed terms never authenticate a carrier, provider, quote or funding.
export function protectionContractTerms(action, body) {
  if (!PROTECTION_CONTRACT_ACTIONS.includes(action)) fail();
  if (action === 'fund') {
    exact(body, ['campaignId', 'campaignSourceHash', 'priceCash', 'lifetimeSeconds', 'service', 'consent']);
    if (body.consent !== true || body.service !== PROTECTION_CONTRACTS.service) fail();
    return { campaignId: identity(body.campaignId), campaignSourceHash: digest(body.campaignSourceHash),
      priceCash: whole(body.priceCash, M3.BODYGUARD_MIN_PRICE, PROTECTION_CONTRACTS.maximumCash),
      lifetimeSeconds: whole(body.lifetimeSeconds, PROTECTION_CONTRACTS.minimumSeconds, PROTECTION_CONTRACTS.maximumSeconds),
      service: PROTECTION_CONTRACTS.service, consent: true };
  }
  exact(body, ['contractId', 'sourceHash', 'consent']);
  if (body.consent !== true) fail();
  return { contractId: identity(body.contractId), sourceHash: digest(body.sourceHash), consent: true };
}

// Read-only discovery schemas describe the existing authenticated routes/DTOs.
// The existing PROTECTION_CONTRACTS constant remains the runtime configuration.
const protectionSchemaId = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' };
const protectionSchemaHash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const protectionSchemaDate = { type: 'string', format: 'date-time' };
const protectionSchemaNullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const protectionSchemaObject = properties => ({ type: 'object', additionalProperties: false,
  required: Object.keys(properties), properties });
const protectionSchemaCash = { type: 'integer', minimum: 0, maximum: PROTECTION_CONTRACTS.maximumCash };
const protectionSchemaRef = name => ({ $ref: '#/components/schemas/' + name });
const protectionSchemaView = {
  contractId: protectionSchemaId, sourceHash: protectionSchemaHash,
  campaignId: protectionSchemaId, campaignSourceHash: protectionSchemaHash,
  courierId: protectionSchemaId, courierSourceHash: protectionSchemaHash, itemId: protectionSchemaId,
  leg: { enum: ['first_leg', 'second_leg'] }, state: { enum: ['funded', 'accepted', 'blocked', 'activated', 'refunded', 'expired'] },
  service: { const: PROTECTION_CONTRACTS.service }, payerAccount: protectionSchemaId, payerOriginal: protectionSchemaId,
  protectedOriginal: protectionSchemaId, guardAccount: protectionSchemaId, guardOriginal: protectionSchemaId,
  priceCash: { type: 'integer', minimum: M3.BODYGUARD_MIN_PRICE, maximum: PROTECTION_CONTRACTS.maximumCash },
  reservedCash: protectionSchemaCash, paidCash: protectionSchemaCash, refundedCash: protectionSchemaCash,
  expiresAt: protectionSchemaDate, coverageUntil: protectionSchemaNullable(protectionSchemaDate),
  closureReason: protectionSchemaNullable({ enum: ['payer_refund', 'source_expiry', 'guard_withdraw', 'guard_death',
    'payer_estate', 'stale_source', 'service_purchased'] }),
  executionAuthority: { const: false }, gameCashOnly: { const: true },
  evidence: protectionSchemaNullable({ const: 'purchased_bodyguard_coverage' }),
};
const protectionSchemaReference = protectionSchemaObject({ contractId: protectionSchemaId,
  sourceHash: protectionSchemaHash, consent: { const: true } });
const protectionSchemaFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) protectionSchemaFreeze(child);
    Object.freeze(value);
  }
  return value;
};
export const PROTECTION_CONTRACT_SCHEMAS = protectionSchemaFreeze({
  ProtectionContractFundBody: protectionSchemaObject({ campaignId: protectionSchemaId, campaignSourceHash: protectionSchemaHash,
    priceCash: { type: 'integer', minimum: M3.BODYGUARD_MIN_PRICE, maximum: PROTECTION_CONTRACTS.maximumCash },
    lifetimeSeconds: { type: 'integer', minimum: PROTECTION_CONTRACTS.minimumSeconds, maximum: PROTECTION_CONTRACTS.maximumSeconds },
    service: { const: PROTECTION_CONTRACTS.service }, consent: { const: true } }),
  ProtectionContractReferenceBody: protectionSchemaReference,
  ProtectionContractView: protectionSchemaObject(protectionSchemaView),
  ProtectionContractReceipt: protectionSchemaObject({ ok: { const: true }, contract: protectionSchemaRef('ProtectionContractView') }),
  ProtectionContractBoard: protectionSchemaObject({ contracts: { type: 'array', maxItems: 20,
    items: protectionSchemaObject({ ...protectionSchemaView, blockedReason: protectionSchemaNullable({ type: 'string' }),
      recoveryActions: { type: 'array', maxItems: 2, uniqueItems: true, items: { enum: ['refund', 'expire', 'withdraw'] } } }) },
    next: protectionSchemaNullable(protectionSchemaId), gameCashOnly: { const: true } }),
});
const protectionSchemaKey = { name: 'Idempotency-Key', in: 'header', required: true,
  schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[!-~]{1,128}$' } };
export const PROTECTION_CONTRACT_OPERATIONS = protectionSchemaFreeze({
  'GET /v1/company/protection-contracts': { operationId: 'protectionContractBoard',
    requestParameters: [{ name: 'after', in: 'query', required: false,
      schema: { anyOf: [{ const: '' }, protectionSchemaId] } }],
    responseSchema: protectionSchemaRef('ProtectionContractBoard') },
  ...Object.fromEntries(PROTECTION_CONTRACT_ACTIONS.map(action => ['POST /v1/company/protection-contracts/' + action, {
    operationId: 'protectionContract' + action[0].toUpperCase() + action.slice(1),
    requestSchema: PROTECTION_CONTRACT_SCHEMAS[action === 'fund' ? 'ProtectionContractFundBody' : 'ProtectionContractReferenceBody'],
    requestParameters: [protectionSchemaKey], responseSchema: protectionSchemaRef('ProtectionContractReceipt'),
  }])),
});
