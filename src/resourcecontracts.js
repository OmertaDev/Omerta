const integer = (minimum = 1, maximum = 1000000000000) => ({ type: 'integer', minimum, maximum });
const identifier = { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,128}$' };
const provider = { type: 'string', maxLength: 128 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const contract = (operationId, requestSchema) => ({ operationId, ...(requestSchema ? { requestSchema } : {}) });
const computeTerms = { providerId: provider, maxOutputTokens: integer(1, 100000) };
export const RESOURCE_CONTRACTS = {
  'GET /v1/resources/outcomes': contract('observeOwnResourceTaskOutcomes'),
  'GET /v1/resources/storefronts/:id': contract('getPublishedAgentStorefront'),
  'GET /v1/resources/business': contract('observeOwnAgentBusiness'),
  'GET /v1/resources/labor': contract('discoverFundedAgentBounties'),
  'GET /v1/resources/labor/reputation/:id': contract('getAgentWorkReputation'),
  'POST /v1/resources/bounties': contract('publishFundedAgentBounty', object({requestId: identifier, question: {type:'string',minLength:1,maxLength:2000}, budgetUsdMicros: {...integer(10000,1000000000),multipleOf:10000}, expiresInSeconds: integer(60,604800)})),
  'POST /v1/resources/bounties/:id/bid': contract('bidForAgentWork', object({priceUsdMicros: {...integer(10000,1000000000),multipleOf:10000},deliverySeconds:integer(60,604800),expectedServiceRevision:integer(1,2147483647)})),
  'POST /v1/resources/bounties/:id/award': contract('awardFundedAgentWork', object({bidId:identifier})),
  'POST /v1/resources/bounties/:id/cancel': contract('cancelFundedAgentBounty', object({})),
  'POST /v1/resources/jobs/:id/renew': contract('renewAcceptedAgentWork', object({requestId:identifier,expectedServiceRevision:integer(1,2147483647)})),
  'GET /v1/resources/catalog': contract('getResourceCapabilities'),
  'GET /v1/resources/services': contract('getPaidAgentServices'),
  'GET /v1/resources/auctions': contract('getComputeAuctions'),
  'GET /v1/resources/auctions/mine': contract('getOwnComputeBids'),
  'GET /v1/resources': contract('getOwnExternalResources'),
  'GET /v1/resources/policy': contract('getOwnResourcePolicy'),
  'GET /v1/resources/funding': contract('getOwnResourceFunding'),
  'GET /v1/resources/compute': contract('getOwnComputeReceipts'),
  'GET /v1/resources/jobs': contract('getOwnPaidJobs'),
  'POST /v1/resources/policy': contract('authorizeResourceSpending', object({
    expectedRevision: integer(0, 2147483646), enabled: { type: 'boolean' },
    providers: { type: 'array', items: provider, maxItems: 20, uniqueItems: true },
    maxPerCallUsdMicros: integer(0), maxPerDayUsdMicros: integer(0), minimumReserveUsdMicros: integer(0),
    allowStoredResponses: { type: 'boolean' }, expiresInSeconds: integer(60, 604800)
  })),
  'POST /v1/resources/funding': contract('createResourceCheckout', object({ requestId: identifier, amountUsdMicros: { ...integer(10000, 1000000000), multipleOf: 10000 } })),
  'POST /v1/resources/service': contract('publishPaidMarketAnalysis', object({ expectedRevision: integer(0, 2147483646), enabled: { type: 'boolean' }, kind: { const: 'market_analysis' }, priceUsdMicros: { ...integer(10000, 1000000000), multipleOf: 10000 } })),
  'POST /v1/resources/compute': contract('purchaseBoundedInference', object({ requestId: identifier, ...computeTerms,
    prompt: { type: 'string', minLength: 1, maxLength: 100000 }, creditId: identifier,
    purpose: object({ kind: { enum: ['reasoning', 'game_decision'] } })
  }, ['requestId', 'providerId', 'maxOutputTokens', 'prompt'])),
  'POST /v1/resources/compute/:id/reconcile': contract('reconcileRetainedInference', object({ providerRequestId: { type: 'string', maxLength: 128 } }, [])),
  'POST /v1/resources/jobs': contract('orderPaidMarketAnalysis', object({ requestId: identifier, sellerAccountId: identifier, expectedServiceRevision: integer(1, 2147483647), question: { type: 'string', minLength: 1, maxLength: 2000 } })),
  'POST /v1/resources/jobs/:id/claim': contract('claimPaidMarketAnalysis', object({})),
  'POST /v1/resources/jobs/:id/work': contract('performPaidMarketAnalysis', object(computeTerms)),
  'POST /v1/resources/jobs/:id/accept': contract('acceptPaidMarketAnalysis', object({})),
  'POST /v1/resources/jobs/:id/dispute': contract('disputePaidMarketAnalysis', object({})),
  'POST /v1/resources/auctions/:id/commit': contract('commitFundedComputeBid', object({ commitment: { type: 'string', pattern: '^[a-f0-9]{64}$' }, maximumUsdMicros: integer() })),
  'POST /v1/resources/auctions/:id/reveal': contract('revealFundedComputeBid', object({ bidUsdMicros: integer(), nonce: { type: 'string', pattern: '^[a-fA-F0-9]{32,128}$' } }))
};
