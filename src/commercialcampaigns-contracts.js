import { DISTRICTS, M3 } from './rules.js';
import { INTEL_FORECAST } from './intelforecasts.js';

export const COMMERCIAL_CAMPAIGNS = Object.freeze({
  roles: Object.freeze(['owner', 'scout', 'manufacturer', 'guard', 'first_carrier', 'second_carrier']),
  stages: Object.freeze(['scout', 'manufacture', 'guard', 'courier']),
  activePerOriginal: 1, offeredPerOwner: 1, minimumSeconds: 60, maximumSeconds: 3600,
  maximumManufacturingFee: 100000, maximumGuardPrice: 100000, maximumCarrierFee: 1000,
  recipeId: 'recipe:precision_lock_tool', outputTemplate: 'item:precision_lock_tool',
  guardEvidence: 'purchased_bodyguard_coverage', gameCashOnly: true,
});

export const COMMERCIAL_CAMPAIGN_ACTIONS = Object.freeze([
  'create', 'consent', 'withdraw', 'cancel', 'expire', 'scout-fund', 'scout-report',
  'manufacture-fund', 'manufacture-accept', 'manufacture-complete', 'guard-hire',
  'courier-publish', 'courier-consent', 'courier-dispatch', 'courier-travel',
  'courier-handoff', 'courier-arrive',
]);

const createFields = Object.freeze([
  'partnershipId', 'relationshipHash', 'teamRevision', 'businessId',
  'manufacturerAccountId', 'guardAccountId', 'firstCarrierAccountId', 'secondCarrierAccountId',
  'origin', 'handoff', 'destination', 'scoutFeeCash', 'minimumStock', 'scoutTargetAt',
  'manufacturingFeeCash', 'guardPriceCash', 'firstFeeCash', 'secondFeeCash',
  'lifetimeSeconds', 'consent',
]);
const referenceFields = Object.freeze(['campaignId', 'sourceHash', 'consent']);
const fail = () => { throw new TypeError('Invalid commercial campaign terms.'); };

function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail();
  for (const field of fields) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, field), 'value')) fail();
  }
}

const identity = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail();
  return value;
};
const digest = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
};
const whole = (value, minimum, maximum) => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail();
  return value;
};
const district = value => {
  if (!DISTRICTS.some(row => row.id === value)) fail();
  return value;
};
const timestamp = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail();
  return value;
};

// These pure terms do not authenticate a team, source, original party or payment.
// The runtime must resolve every source from canonical rows in its actual transaction.
export function commercialCampaignTerms(action, body) {
  if (!COMMERCIAL_CAMPAIGN_ACTIONS.includes(action)) fail();
  if (action === 'create') {
    exact(body, createFields);
    if (body.consent !== true) fail();
    const result = {
      partnershipId: identity(body.partnershipId), relationshipHash: digest(body.relationshipHash),
      teamRevision: whole(body.teamRevision, 1, 2147483647), businessId: identity(body.businessId),
      manufacturerAccountId: identity(body.manufacturerAccountId), guardAccountId: identity(body.guardAccountId),
      firstCarrierAccountId: identity(body.firstCarrierAccountId), secondCarrierAccountId: identity(body.secondCarrierAccountId),
      origin: district(body.origin), handoff: district(body.handoff), destination: district(body.destination),
      scoutFeeCash: whole(body.scoutFeeCash, INTEL_FORECAST.minFeeCash, INTEL_FORECAST.maxFeeCash),
      minimumStock: whole(body.minimumStock, INTEL_FORECAST.minStock, INTEL_FORECAST.maxStock),
      scoutTargetAt: timestamp(body.scoutTargetAt),
      manufacturingFeeCash: whole(body.manufacturingFeeCash, 1, COMMERCIAL_CAMPAIGNS.maximumManufacturingFee),
      guardPriceCash: whole(body.guardPriceCash, M3.BODYGUARD_MIN_PRICE, COMMERCIAL_CAMPAIGNS.maximumGuardPrice),
      firstFeeCash: whole(body.firstFeeCash, 1, COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
      secondFeeCash: whole(body.secondFeeCash, 1, COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
      lifetimeSeconds: whole(body.lifetimeSeconds, COMMERCIAL_CAMPAIGNS.minimumSeconds, COMMERCIAL_CAMPAIGNS.maximumSeconds),
      consent: true,
    };
    if (new Set([result.manufacturerAccountId, result.guardAccountId,
      result.firstCarrierAccountId, result.secondCarrierAccountId]).size !== 4
      || new Set([result.origin, result.handoff, result.destination]).size !== 3) fail();
    return result;
  }
  exact(body, action === 'scout-report' ? [...referenceFields, 'predictsAvailable'] : referenceFields);
  if (body.consent !== true) fail();
  const result = { campaignId: identity(body.campaignId), sourceHash: digest(body.sourceHash), consent: true };
  if (action === 'scout-report') {
    if (typeof body.predictsAvailable !== 'boolean') fail();
    result.predictsAvailable = body.predictsAvailable;
  }
  return result;
}

// Closed public route metadata. Canonical terms, authorization and source ACKs remain authoritative.
const commercialSchemaObject = properties => ({ type: 'object', additionalProperties: false,
  required: Object.keys(properties), properties });
const commercialSchemaNullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const commercialSchemaWhole = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const commercialSchemaId = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$', minLength: 1, maxLength: 128 };
const commercialSchemaHash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
// Date parsing and the actual current forecast window remain canonical runtime checks.
const commercialSchemaTimestamp = { type: 'string',
  pattern: '^(?:[0-9]{4}|[+-][0-9]{6})-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$' };
const commercialSchemaDistrict = { type: 'string', enum: DISTRICTS.map(row => row.id) };
const commercialSchemaRef = name => ({ $ref: '#/components/schemas/' + name });
const commercialSchemaTerms = commercialSchemaObject({
  partnershipId: commercialSchemaId, relationshipHash: commercialSchemaHash,
  teamRevision: commercialSchemaWhole(1, 2147483647), businessId: commercialSchemaId,
  manufacturerAccountId: commercialSchemaId, guardAccountId: commercialSchemaId,
  firstCarrierAccountId: commercialSchemaId, secondCarrierAccountId: commercialSchemaId,
  origin: commercialSchemaDistrict, handoff: commercialSchemaDistrict, destination: commercialSchemaDistrict,
  scoutFeeCash: commercialSchemaWhole(INTEL_FORECAST.minFeeCash, INTEL_FORECAST.maxFeeCash),
  minimumStock: commercialSchemaWhole(INTEL_FORECAST.minStock, INTEL_FORECAST.maxStock),
  scoutTargetAt: commercialSchemaTimestamp,
  manufacturingFeeCash: commercialSchemaWhole(1, COMMERCIAL_CAMPAIGNS.maximumManufacturingFee),
  guardPriceCash: commercialSchemaWhole(M3.BODYGUARD_MIN_PRICE, COMMERCIAL_CAMPAIGNS.maximumGuardPrice),
  firstFeeCash: commercialSchemaWhole(1, COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
  secondFeeCash: commercialSchemaWhole(1, COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
  lifetimeSeconds: commercialSchemaWhole(COMMERCIAL_CAMPAIGNS.minimumSeconds, COMMERCIAL_CAMPAIGNS.maximumSeconds),
  consent: { const: true },
});
const commercialSchemaViewProperties = {
  campaignId: commercialSchemaId, sourceHash: commercialSchemaHash, partnershipId: commercialSchemaId,
  businessId: commercialSchemaId, state: { enum: ['offered', 'active', 'cancelled', 'suspended', 'expired', 'completed'] },
  stage: { enum: [...COMMERCIAL_CAMPAIGNS.stages, 'complete'] }, terms: commercialSchemaRef('CommercialCampaignTerms'),
  roles: { type: 'array', minItems: COMMERCIAL_CAMPAIGNS.roles.length, maxItems: COMMERCIAL_CAMPAIGNS.roles.length,
    items: commercialSchemaObject({ role: { enum: [...COMMERCIAL_CAMPAIGNS.roles] },
      accountId: commercialSchemaId, originalCharacterId: commercialSchemaId }),
    allOf: COMMERCIAL_CAMPAIGNS.roles.map(role => ({ contains: commercialSchemaObject({ role: { const: role },
      accountId: commercialSchemaId, originalCharacterId: commercialSchemaId }) })) },
  expiresAt: commercialSchemaTimestamp, executionAuthority: { const: false },
  guardEvidence: { const: COMMERCIAL_CAMPAIGNS.guardEvidence },
  stageFeesFundedSeparately: { const: true }, gameCashOnly: { const: true },
};
const commercialSchemaStages = COMMERCIAL_CAMPAIGNS.stages.map(kind => commercialSchemaObject({
  kind: { const: kind }, state: { enum: kind === 'guard' ? ['pending', 'completed', 'retired']
    : kind === 'scout' ? ['pending', 'funded', 'completed', 'retired']
      : kind === 'manufacture' ? ['pending', 'funded', 'accepted', 'completed', 'retired']
        : ['pending', 'prepared', 'funded', 'accepted', 'completed', 'retired'] },
  sourceId: commercialSchemaNullable(commercialSchemaId), outputItemId: commercialSchemaNullable(commercialSchemaId),
}));
const commercialSchemaBoardCampaign = commercialSchemaObject({ ...commercialSchemaViewProperties,
  supportedStage: commercialSchemaNullable({ enum: [...COMMERCIAL_CAMPAIGNS.stages, 'complete'] }),
  blockedReason: commercialSchemaNullable({ enum: ['original_replaced', 'terminal_metadata', 'campaign_expired',
    'canonical_source_completed_independently', 'canonical_source_changed', 'native_source_graph_unavailable',
    'canonical_window_insufficient'] }),
  retireActions: { type: 'array', maxItems: 1, uniqueItems: true, items: { enum: ['cancel', 'withdraw'] } },
  recovery: { const: 'Retiring campaign metadata does not refund, cancel or alter independent canonical source obligations.' },
  stages: { type: 'array', minItems: COMMERCIAL_CAMPAIGNS.stages.length,
    maxItems: COMMERCIAL_CAMPAIGNS.stages.length, items: { oneOf: commercialSchemaStages },
    allOf: commercialSchemaStages.map(stage => ({ contains: stage })) },
});
const commercialSchemaTravel = commercialSchemaNullable(commercialSchemaObject({
  from: commercialSchemaDistrict, to: commercialSchemaDistrict, original: commercialSchemaId,
  transaction: commercialSchemaId, cost: commercialSchemaWhole(0, Number.MAX_SAFE_INTEGER), observedAt: commercialSchemaTimestamp,
}));
const commercialSchemaReceipt = extra => commercialSchemaObject({ ok: { const: true },
  campaign: commercialSchemaRef('CommercialCampaignView'), ...extra });
const commercialSchemaScout = reported => commercialSchemaObject({ kind: { const: 'scout' }, sourceId: commercialSchemaId,
  state: { const: reported ? 'completed' : 'funded' },
  feeCash: commercialSchemaWhole(INTEL_FORECAST.minFeeCash, INTEL_FORECAST.maxFeeCash),
  paidFeeCash: reported ? commercialSchemaWhole(INTEL_FORECAST.minFeeCash, INTEL_FORECAST.maxFeeCash) : { const: 0 },
  targetAt: commercialSchemaTimestamp, reportedAt: reported ? commercialSchemaTimestamp : { type: 'null' },
  predictsAvailable: reported ? { type: 'boolean' } : { type: 'null' },
  observedStock: reported ? commercialSchemaWhole(0, INTEL_FORECAST.stockPerBlock) : { type: 'null' },
});
const commercialSchemaManufacture = state => commercialSchemaObject({ kind: { const: 'manufacture' },
  sourceId: commercialSchemaId, sourceHash: commercialSchemaHash, state: { const: state },
  recipeId: { const: COMMERCIAL_CAMPAIGNS.recipeId },
  feeCash: commercialSchemaWhole(1, COMMERCIAL_CAMPAIGNS.maximumManufacturingFee),
  paidFeeCash: state === 'completed' ? commercialSchemaWhole(1, COMMERCIAL_CAMPAIGNS.maximumManufacturingFee) : { const: 0 },
  outputItemId: state === 'completed' ? commercialSchemaId : { type: 'null' },
});
const commercialSchemaGuard = commercialSchemaObject({ kind: { const: 'guard' }, state: { const: 'completed' },
  evidence: { const: COMMERCIAL_CAMPAIGNS.guardEvidence },
  priceCash: commercialSchemaWhole(M3.BODYGUARD_MIN_PRICE, COMMERCIAL_CAMPAIGNS.maximumGuardPrice),
  paidGuardCash: commercialSchemaWhole(0, COMMERCIAL_CAMPAIGNS.maximumGuardPrice),
  canonicalFeeCash: commercialSchemaWhole(0, COMMERCIAL_CAMPAIGNS.maximumGuardPrice),
  streetTaxCash: commercialSchemaWhole(0, COMMERCIAL_CAMPAIGNS.maximumGuardPrice),
  until: commercialSchemaTimestamp, payerJournal: commercialSchemaId, guardJournal: commercialSchemaId,
});
const commercialSchemaCourier = action => commercialSchemaObject({ kind: { const: 'courier' },
  sourceId: commercialSchemaId, sourceHash: commercialSchemaHash, itemId: commercialSchemaId,
  state: { enum: action === 'courier-publish' ? ['offered'] : action === 'courier-consent' ? ['offered', 'ready']
    : action === 'courier-dispatch' ? ['first_leg'] : action === 'courier-travel' ? ['first_leg', 'second_leg']
      : action === 'courier-handoff' ? ['second_leg'] : ['completed'] },
  firstConsent: { type: 'boolean' }, secondConsent: { type: 'boolean' },
  reservedCash: commercialSchemaWhole(0, 2 * COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
  paidFirstCash: commercialSchemaWhole(0, COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
  paidSecondCash: commercialSchemaWhole(0, COMMERCIAL_CAMPAIGNS.maximumCarrierFee),
  firstTravel: commercialSchemaTravel, secondTravel: commercialSchemaTravel,
});
const commercialSchemaResults = Object.fromEntries(COMMERCIAL_CAMPAIGN_ACTIONS.map(action => [action,
  action === 'create' ? commercialSchemaReceipt({ consentedRole: { const: 'owner' } })
    : action === 'consent' ? commercialSchemaReceipt({ consentedRole: { enum: COMMERCIAL_CAMPAIGNS.roles.filter(role => role !== 'owner') } })
      : ['withdraw', 'cancel', 'expire'].includes(action) ? commercialSchemaReceipt({ retiredMetadataOnly: { const: true } })
        : action.startsWith('scout-') ? commercialSchemaReceipt({ source: commercialSchemaScout(action === 'scout-report') })
          : action.startsWith('manufacture-') ? commercialSchemaReceipt({ source: commercialSchemaManufacture(
            action === 'manufacture-fund' ? 'funded' : action === 'manufacture-accept' ? 'accepted' : 'completed') })
            : action === 'guard-hire' ? commercialSchemaReceipt({ source: commercialSchemaGuard })
              : commercialSchemaReceipt({ source: commercialSchemaCourier(action) }),
]));
const commercialSchemaResultName = action => 'CommercialCampaign' + action.split('-')
  .map(part => part[0].toUpperCase() + part.slice(1)).join('') + 'Result';
const commercialSchemaFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const entry of Object.values(value)) commercialSchemaFreeze(entry);
    Object.freeze(value);
  }
  return value;
};
export const COMMERCIAL_CAMPAIGN_SCHEMAS = commercialSchemaFreeze({
  CommercialCampaignTerms: commercialSchemaTerms,
  CommercialCampaignView: commercialSchemaObject(commercialSchemaViewProperties),
  CommercialCampaignBoard: commercialSchemaObject({ campaigns: { type: 'array', maxItems: 20,
    items: commercialSchemaBoardCampaign }, next: commercialSchemaNullable(commercialSchemaId),
    executionAuthority: { const: false }, guardEvidence: { const: COMMERCIAL_CAMPAIGNS.guardEvidence }, gameCashOnly: { const: true } }),
  ...Object.fromEntries(COMMERCIAL_CAMPAIGN_ACTIONS.map(action => [commercialSchemaResultName(action), commercialSchemaResults[action]])),
});
const commercialSchemaKey = { name: 'Idempotency-Key', in: 'header', required: true,
  schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[!-~]{1,128}$' } };
const commercialSchemaReference = { campaignId: commercialSchemaId, sourceHash: commercialSchemaHash, consent: { const: true } };
export const COMMERCIAL_CAMPAIGN_CONTRACTS = commercialSchemaFreeze({
  'GET /v1/company/commercial-campaigns': { operationId: 'commercialCampaignBoard',
    requestParameters: [{ name: 'after', in: 'query', required: false,
      schema: { anyOf: [{ const: '' }, commercialSchemaId] } }],
    responseSchema: commercialSchemaRef('CommercialCampaignBoard') },
  ...Object.fromEntries(COMMERCIAL_CAMPAIGN_ACTIONS.map(action => ['POST /v1/company/commercial-campaigns/' + action, {
    operationId: 'commercialCampaign' + action.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(''),
    requestSchema: action === 'create' ? commercialSchemaTerms : commercialSchemaObject({ ...commercialSchemaReference,
      ...(action === 'scout-report' ? { predictsAvailable: { type: 'boolean' } } : {}) }),
    requestParameters: [commercialSchemaKey], responseSchema: commercialSchemaRef(commercialSchemaResultName(action)),
  }])),
});
