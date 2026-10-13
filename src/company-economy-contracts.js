// Discovery contracts mirror canonical production and observed retail evidence.
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const id = { type: 'string', minLength: 1, maxLength: 200 };
const depotId = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' };
const cash = { type: 'integer', minimum: 0 };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const date = { type: ['string', 'null'], format: 'date-time' };
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const array = items => ({ type: 'array', items });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const recipe = { type: 'string', enum: ['recipe:hardened_steel', 'recipe:precision_lock_tool', 'recipe:tempered_precision_lock_tool'] };
const windowHours = { type: 'integer', enum: [4, 12, 24] };
const horizonHours = { type: 'integer', enum: [1, 4] };
const forecastTerms = object({ horizonHours, windowHours });
const scenario = object({ horizonHours, windowHours, maxBudgetCash: { type: 'integer', minimum: 50, maximum: 100000000 },
  preference: { type: 'string', enum: ['price', 'availability'] }, priceChangeBps: { type: 'integer', enum: [-500, 0, 500] },
  sensitivity: { type: 'string', enum: ['low', 'medium', 'high'] } });
const config = object({ salePrice: { type: 'integer', minimum: 50, maximum: 1000000 }, bidPrice: { type: 'integer', minimum: 50, maximum: 1000000 },
  targetStock: { type: 'integer', minimum: 1, maximum: 40 }, reorderAt: { type: 'integer', minimum: 0, maximum: 39 },
  restockBudget: { type: 'integer', minimum: 50, maximum: 100000000 } });
const inputWitness = object({ scope: { const: 'worldgraph_purchased_production_inputs' }, status: { const: 'unavailable' }, reason: { type: 'string' } });
const observed = object({ status: { type: 'string' }, samples: { type: 'integer', minimum: 0, maximum: 200 }, units: { type: ['integer', 'null'], minimum: 0 },
  band: { type: 'string', enum: ['unknown', 'low', 'medium', 'high'] }, stockoutCensored: { type: 'boolean' }, latestAt: date });
const action = nullable(object({ kind: { const: 'canonical_depot_configure' }, method: { const: 'POST' }, path: { type: 'string' }, body: config, requires: { type: 'string' } }));
const character = { type: 'object', description: 'Canonical current player character projection from readCharacter/withCharacter.' };
const projection = { character, ok: { const: true }, projectedUnits: { type: ['integer', 'null'], minimum: 0 }, budgetCashBound: cash,
  canonicalProcurementBound: { type: ['object', 'null'] }, currentStock: cash, evidenceId: hash, action, productionInputs: inputWitness };
const apply = source => object({ character, ok: { const: true }, id, applied: config, source: { const: source }, gameCashDebited: { const: 0 } });
const step = object({ recipeId: recipe, repeat: { type: 'integer', minimum: 1, maximum: 6 } });
const steps = { ...array(step), minItems: 1, maxItems: 3 };
const key = { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', pattern: '^[!-~]{1,128}$' },
  description: 'Persist before submitting. Retry the same body and key after an ambiguous response.' };
const contract = (operationId, responseSchema, requestSchema, keyed = false) => ({ operationId, responseSchema,
  ...(requestSchema ? { requestSchema } : {}), ...(keyed ? { requestParameters: [key] } : {}) });
const grant = object({ enabled: { type: 'boolean' }, expiresAt: date, maxBatchCashCost: cash, maxGrantCashCost: cash, spent: cash });
const specialization = object({ businessId: id, expectedRevision: { type: 'integer', minimum: 0, maximum: 2147483646 },
  kind: { type: 'string', enum: ['volume', 'quality', 'speed', 'niche'] }, recipeIds: { ...array(recipe), maxItems: 2, uniqueItems: true },
  toolItemId: nullable(id), allowAgentProduction: { type: 'boolean' }, agentGrantSeconds: { type: 'integer', minimum: 0, maximum: 86400 },
  maxBatchCashCost: { type: 'integer', minimum: 0, maximum: 1800 }, maxGrantCashCost: { type: 'integer', minimum: 0, maximum: 1800 }, renewAgentGrant: { type: 'boolean' } });
specialization.allOf = [
  { if: { properties: { kind: { const: 'niche' } } }, then: { properties: { recipeIds: { minItems: 1 } } }, else: { properties: { recipeIds: { maxItems: 0 } } } },
  { if: { properties: { kind: { const: 'quality' } } }, then: { properties: { toolItemId: id } }, else: { properties: { toolItemId: { type: 'null' } } } },
  { if: { properties: { allowAgentProduction: { const: true } } }, then: { properties: { agentGrantSeconds: { minimum: 60 } } },
    else: { properties: { agentGrantSeconds: { const: 0 }, maxBatchCashCost: { const: 0 }, maxGrantCashCost: { const: 0 }, renewAgentGrant: { const: false } } } },
];
export const COMPANY_ECONOMY_SCHEMAS = {
  CompanyProductionReceipt: object({ ok: { const: true }, runId: id, originalCharacter: id, businessId: id,
    sourcePin: object({ authority: { type: 'string' }, code: { type: 'object', additionalProperties: hash }, recipes: array(object({ recipeId: recipe, definitionHash: hash })) }),
    steps, totalCrafts: { type: 'integer', minimum: 1, maximum: 6 }, totalCashCost: { ...cash, maximum: 1800 }, authority: { type: 'string' }, quality: { type: 'string' },
    crafts: array(object({ ordinal: { type: 'integer', minimum: 0, maximum: 5 }, key: { type: 'string' }, receipt: ref('WorldGraphMutationReceipt'), admission: { type: 'object' } }, ['ordinal', 'key', 'receipt'])) }),
  CompanyProductionBoard: object({ recipes: array(object({ id: recipe, title: { type: 'string' }, inputs: array(ref('WorldGraphRecipeEntry')), outputs: array(ref('WorldGraphRecipeEntry')), cashCost: cash })),
    receipts: array(object({ requestKey: { type: 'string' }, receipt: ref('CompanyProductionReceipt') })), nextCursor: { type: ['string', 'null'] }, limits: { type: 'object' } }),
  CompanySpecializationReceipt: object({ ok: { const: true }, businessId: id, revision: { type: 'integer', minimum: 1 }, kind: specialization.properties.kind,
    maxCrafts: { type: 'integer', minimum: 1, maximum: 6 }, cadence: { type: 'integer', minimum: 60, maximum: 300 }, immutableRecipeQuality: { const: true }, agentGrant: grant, replayed: { const: true } },
    ['ok', 'businessId', 'revision', 'kind', 'maxCrafts', 'cadence', 'immutableRecipeQuality', 'agentGrant']),
  CompanyDemand: object({ character, ok: { const: true }, scope: { const: 'observed_gin_retail_only' }, district: { type: 'string' }, good: { type: 'string' }, asOf: { type: 'string', format: 'date-time' }, windowHours,
    observedDepotPurchases: observed, shopTurnover: { oneOf: [object({ status: { const: 'unavailable' } }), object({ status: { const: 'current_block_counter' }, block: cash, bought: cash, sold: cash, notHistoricalSamples: { const: true } })] },
    marketFillHistory: object({ status: { const: 'unavailable' }, reason: { type: 'string' } }), productionInputs: inputWitness }),
  CompanyDemandScenario: object({ ...projection, type: { const: 'counterfactual_scenario' }, notHistoricalSales: { const: true }, notCustomerCommitment: { const: true }, assumptions: scenario, observed, model: { type: 'string' } }),
  CompanyInventoryForecast: object({ ...projection, type: { const: 'observed_inventory_forecast' }, scope: { const: 'owned_gin_depot_retail_history' }, asOf: { type: 'string', format: 'date-time' }, horizonHours, windowHours,
    status: { type: 'string' }, samples: cash, stockoutCensored: { type: 'boolean' }, method: { type: 'string' }, exposureHours: { type: 'number', minimum: 0 },
    scenarioRange: nullable(object({ min: cash, max: cash, notStatisticalConfidence: { const: true } })), capacityAvailable: cash, noFutureObservations: { const: true } }),
  ItemDurabilityBoard: object({ character, items: array(object({ itemId: id, remaining: { ...cash, maximum: 150 }, maximum: { type: 'integer', enum: [100, 150] }, manufacturingGrade: { type: 'string', enum: ['standard', 'tempered'] }, revision: cash, creationQualityUnchanged: { const: true } })), repairAvailable: { const: false } }),
};
export const COMPANY_ECONOMY_CONTRACTS = {
  'GET /v1/company/production': { ...contract('getCompanyProduction', ref('CompanyProductionBoard')), requestParameters: [{ name: 'after', in: 'query', schema: key.schema }] },
  'POST /v1/company/production/run': contract('runCompanyProduction', ref('CompanyProductionReceipt'), object({ businessId: { ...id, maxLength: 128, pattern: '^(?!\\s)(?:.*\\S)$' }, steps }), true),
  'GET /v1/company/specializations': contract('getCompanySpecializations', array({ type: 'object' })),
  'POST /v1/company/specializations': contract('setCompanySpecialization', ref('CompanySpecializationReceipt'), specialization, true),
  'GET /v1/items/durability': contract('getItemDurability', ref('ItemDurabilityBoard')),
  'GET /v1/company/demand/:id': { ...contract('getCompanyDemand', ref('CompanyDemand')), pathSchemas: { id: depotId }, requestParameters: [{ name: 'windowHours', in: 'query', schema: windowHours }] },
  'POST /v1/company/demand/:id/scenario': { ...contract('modelCompanyDemandScenario', ref('CompanyDemandScenario'), scenario), pathSchemas: { id: depotId } },
  'POST /v1/company/demand/:id/apply': { ...contract('applyCompanyDemandScenario', apply('counterfactual_scenario'), object({ consent: { const: true }, evidenceId: hash, scenario })), pathSchemas: { id: depotId } },
  'POST /v1/company/forecast/:id': { ...contract('getCompanyInventoryForecast', ref('CompanyInventoryForecast'), forecastTerms), pathSchemas: { id: depotId } },
  'POST /v1/company/forecast/:id/apply': { ...contract('applyCompanyInventoryForecast', apply('observed_inventory_forecast'), object({ consent: { const: true }, evidenceId: hash, ...forecastTerms.properties })), pathSchemas: { id: depotId } },
};
