// THE AGENT GATEWAY — the machine-discovery layer. Agents are first-class players (see AGENTS.md),
// so the game publishes a standard OpenAPI 3.1 contract + an llms.txt index, both auto-derived from
// the live route registry (server.js collects routes via an onRoute hook, so this never drifts from
// what's actually mounted). Read-only, keyless, zero §10.4 surface.

// Routes reachable WITHOUT a player token (the discovery + auth surface). Everything else under
// /v1 needs the bearer JWT; anything under /v1/mod/ needs the x-mod-key header instead.
const PUBLIC_PATHS = new Set([
  '/', '/wiki', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json',
  '/v1/rules', '/v1/catalog', '/v1/arena',
  '/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy',
]);

// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).
// /arena is the human-facing showcase page; /v1/arena (its JSON) IS in the contract (agents read it).
const DOC_PATHS = new Set(['/', '/wiki', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json']);

// A short, human-legible summary per top-level system (the OpenAPI tag). Anything unmapped falls
// through to a generic line — the contract stays complete even as new systems land.
const TAG_DESC = {
  auth: 'Authentication: guest, X/Privy sign-in, guest→provider upgrade, and the agent key.',
  character: 'Create/read your character; the on-chain mint that unlocks extraction.',
  crimes: 'The core cash+respect grind.', train: 'Spend energy to raise a stat.',
  bank: 'Deposit/withdraw pocket cash (banked cash is safer but rides in transit).',
  travel: 'Move between districts.', kitchen: 'The drug lab: makings, cook, collect, deal, crew.',
  swap: 'RETIRED — cash and $OMR do not trade; the Exchange window (window) is the one-way $OMR→cash exit.',
  stake: 'The Vault: stake $OMR to cut what a killer takes (20% of a staked balance against 50% of a loose one). Yield goes to the top families, not to stakers.',
  market: 'The black market: car auctions, goods, buy orders.', goods: 'Buy/sell trade goods.',
  convoy: 'Bulk smuggling on a real clock; ambush rivals\' freight.',
  contracts: 'The contract board: browse/fund/cancel kill & hospitalize bounties.',
  streets: 'PvP: jump, search, fire, NPC hits against other players.',
  heists: 'Co-op crew heists and inside jobs.', loans: 'Player-to-player loan sharking + paper market.',
  business: 'Personal fronts: buy, collect, upgrade, upkeep, shakedown (laundering retired).',
  territory: 'Gang-owned district rackets: establish, collect, upgrade, upkeep.',
  gangs: 'Families: found/join, tribute, wars, turf, the treasury, seals, foundation.',
  casino: 'The Gambling Den: craps, numbers, PvP dice, the fight card.',
  speakeasy: 'The nightclub layer: open/run a club, rounds, the back-room table.',
  boxing: 'The fight circuit: sign/train/stake a fighter.', portfolio: 'RETIRED (D11): the stock book is closed — routes are tombstones.',
  law: 'The RICO antagonist: rap sheet, bribe, retainer, plea, the courtroom, informants.',
  pen: 'Prison: the yard, work, shank, contraband, breakouts.',
  wire: 'The intelligence terminal: wiretaps, sweeps, the Street Wire.',
  underworld: 'Named-NPC relationships: standing, gifts, favors, errands.',
  content: 'Hash-pinned authored stories: personal district storylets and organization-scoped mysteries with exact-once rewards.',
  worldgraph: 'Conserved Phase 1 inventory, data-defined crafting, mysteries, and four-account Crew operations. Direct actions only; this surface is not autonomous-agent authority.',
  wallet: 'SIWE wallet linking for on-chain extraction.',
  withdraw: 'Withdraw earned $OMR on-chain (EIP-712 voucher, full-reserve backed; rail not yet open — opens when the audit and launch gates clear).',
  gear: 'Withdraw ERC-1155 gear on-chain.', store: 'Real-money packages (entitlements/access/status).',
  pass: 'The Season Pass reward track.', bonds: 'Reserve bonds (protocol-owned liquidity).',
  auction: 'The weekly $OMR auction house.', estate: 'The personal compound ($OMR status sink).',
  opportunities: 'THE OPPORTUNITY BOARD — every open economic action + standing skill-loop, EV-ranked, with a `best` recommended move, in one read.',
  arena: 'THE ARENA — the public agent hall of fame + agent-economy aggregate (the human showcase is at GET /arena).',
  leaderboard: 'Public status boards (hitmen, recruiters, nightlife, and the AGENT board).',
  onboard: 'The First-Week guided checklist.', social: 'Daily "Spread the Word" tasks (humans only).',
  city: 'The living-world board: events, weather, forecast, the clock.',
  world: 'NPC rival families: co-op raids.', feud: 'The public blood-feud ledger.',
  notifications: 'Your event inbox.', ws: 'The websocket gateway (live feed).',
  vanity: 'Cosmetic $OMR sinks (name, title, plate, crest).', respec: 'Redistribute stats.',
  daily: 'Daily contracts + the Daily Score.', missions: 'One-time scripted jobs.',
  skills: 'The three-branch skill tree.', dynasty: 'Dynastic marriages + the consigliere.',
  landmarks: 'Dedicate a district plaque ($OMR flex).', safehouse: 'Go to ground (survival shield).',
  bodyguard: 'The two-party protection market.',
  session: 'Pre-character session probe.', me: 'Your full character sheet.',
  agent: 'Autonomous turn planning: compact state, extraction readiness, EV-ranked loops and guaranteed earned reward claims, wake scheduling, and server-authorized execution.',
  mod: 'Moderator tools (x-mod-key header, not a player token).',
};

const CONTENT_STALE_RESPONSE = {
  description: 'stale_instance — use the replacement safe instance projection and choose again.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ContentStaleResponse' } } },
};
const CONTENT_STALE_BUNDLE_RESPONSE = {
  description: 'stale_content — refresh the replacement authored workshop before acting.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ContentStaleBundleResponse' } } },
};

const WORLDGRAPH_CANONICAL_IDENTIFIER = {
  type: 'string', minLength: 1, maxLength: 200, pattern: '^(?!\\s)(?:.*\\S)?$',
};
const WORLDGRAPH_PATH_SCHEMAS = {
  itemId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  recipeId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  carId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  graphId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  nodeId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  operationNodeId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  operationId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  roleId: { ...WORLDGRAPH_CANONICAL_IDENTIFIER, maxLength: 80 },
};
const WORLDGRAPH_IDEMPOTENCY_PARAMETER = {
  name: 'Idempotency-Key', in: 'header', required: true,
  description: 'Fresh canonical key for this logical mutation. Exact retries replay; conflicting reuse is refused.',
  schema: WORLDGRAPH_CANONICAL_IDENTIFIER,
};
const WORLDGRAPH_RETRY_AFTER_HEADER = {
  description: 'Whole seconds before the caller should retry.',
  schema: { type: 'integer', minimum: 1 },
};
const WORLDGRAPH_COMMON_RESPONSES = {
  400: {
    description: 'Stable game refusal. Branch on error, never message.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphError' } } },
  },
  401: {
    description: 'Missing, invalid, expired, or revoked bearer token.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphError' } } },
  },
  403: {
    description: 'The authenticated account is banned.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphForbiddenError' } } },
  },
  429: {
    description: 'Account action cadence exceeded.',
    headers: { 'Retry-After': WORLDGRAPH_RETRY_AFTER_HEADER },
    content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphRateLimitError' } } },
  },
  503: {
    description: 'The authoritative database is unavailable; retry later.',
    headers: { 'Retry-After': WORLDGRAPH_RETRY_AFTER_HEADER },
    content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphUnavailableError' } } },
  },
};
const WORLDGRAPH_CONFLICT_RESPONSE = {
  description: 'The logical key is still in progress or locked world state conflicts with another mutation. Refresh or retry as indicated by the stable error code.',
  headers: { 'Retry-After': WORLDGRAPH_RETRY_AFTER_HEADER },
  content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphConflictError' } } },
};
const WORLDGRAPH_KEY_REUSE_RESPONSE = {
  description: 'The Idempotency-Key belongs to a different logical request and cannot be reused.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/WorldGraphKeyReuseError' } } },
};
const WORLDGRAPH_EMPTY_BODY = { type: 'object', additionalProperties: false, properties: {} };
const WORLDGRAPH_INTERACTION_BODY = {
  type: 'object', additionalProperties: false, properties: {
    interactionId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  },
};
const WORLDGRAPH_CHOICE_BODY = {
  type: 'object', additionalProperties: false, required: ['optionId'], properties: {
    optionId: WORLDGRAPH_CANONICAL_IDENTIFIER,
    interactionId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  },
};
const WORLDGRAPH_MYSTERY_CANCEL_BODY = {
  type: 'object', additionalProperties: false, required: ['instanceId'], properties: {
    instanceId: WORLDGRAPH_CANONICAL_IDENTIFIER,
  },
};
const WORLDGRAPH_REPLAY_HEADER = {
  'X-Idempotent-Replay': {
    description: 'Present as true when this is the exact stored response for the same logical request.',
    schema: { type: 'string', const: 'true' },
  },
};
const worldGraphRead = (operationId, responseSchema) => ({
  operationId,
  responseSchema: { $ref: responseSchema },
  pathSchemas: WORLDGRAPH_PATH_SCHEMAS,
  extraResponses: WORLDGRAPH_COMMON_RESPONSES,
});
const worldGraphMutation = (operationId, requestSchema = WORLDGRAPH_EMPTY_BODY) => ({
  operationId,
  requestSchema,
  requestParameters: [WORLDGRAPH_IDEMPOTENCY_PARAMETER],
  responseSchema: { $ref: '#/components/schemas/WorldGraphMutationReceipt' },
  responseHeaders: WORLDGRAPH_REPLAY_HEADER,
  pathSchemas: WORLDGRAPH_PATH_SCHEMAS,
  extraResponses: {
    ...WORLDGRAPH_COMMON_RESPONSES,
    409: WORLDGRAPH_CONFLICT_RESPONSE,
    422: WORLDGRAPH_KEY_REUSE_RESPONSE,
  },
});

// The first strict contracts cover the autonomous hot path. The route registry still guarantees
// COMPLETE path discovery; these overlays replace its generic object body where the server itself
// emits an action that an agent is expected to send back verbatim.
const OPERATION_CONTRACTS = {
  'GET /v1/agent/turn': {
    operationId: 'getAgentTurn',
    responseSchema: { $ref: '#/components/schemas/AgentTurn' },
  },
  'POST /v1/agent/act': {
    operationId: 'executeAgentTurnAction',
    requestSchema: { type: 'object', additionalProperties: false, required: ['turnId', 'actionId'], properties: {
      turnId: { type: 'string', pattern: '^turn_[0-9a-f]{64}$' }, actionId: { type: 'string', minLength: 1 },
    } },
    responseSchema: { $ref: '#/components/schemas/AgentActReceipt' },
    extraResponses: { 409: { description: 'stale_turn — use the replacement AgentTurn in the response and choose again.' } },
  },
  'POST /v1/crimes/:id': {
    operationId: 'commitCrime',
    requestSchema: { type: 'object', additionalProperties: false, properties: {
      approach: { type: 'string', enum: ['quiet', 'standard', 'loud'], default: 'standard' },
    } },
  },
  'POST /v1/market/:id/fill': {
    operationId: 'fillMarketOrder',
    requestSchema: { type: 'object', additionalProperties: false, properties: {
      qty: { type: 'integer', minimum: 1 },
    }, required: ['qty'] },
  },
  'POST /v1/goods/buy': {
    operationId: 'buyTradeGood',
    requestSchema: { type: 'object', additionalProperties: false, required: ['goodId', 'qty'], properties: {
      goodId: { type: 'string' }, qty: { type: 'integer', minimum: 1 },
    } },
  },
  'POST /v1/goods/sell': {
    operationId: 'sellTradeGood',
    requestSchema: { type: 'object', additionalProperties: false, required: ['goodId', 'qty'], properties: {
      goodId: { type: 'string' }, qty: { type: 'integer', minimum: 1 },
    } },
  },
  'POST /v1/crew/recruiting': {
    operationId: 'setCrewRecruiting',
    requestSchema: { type: 'object', additionalProperties: false, required: ['on'], properties: {
      on: { type: 'boolean' },
    } },
  },
  'GET /v1/content': {
    operationId: 'getAuthoredContent',
    responseSchema: { $ref: '#/components/schemas/ContentBoard' },
  },
  'POST /v1/content/:namespace/sources/:sourceId/collect': {
    operationId: 'collectAuthoredContentSource',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentSupplyReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/jobs/:jobId/start': {
    operationId: 'startAuthoredContentWorkOrder',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentWorkOrderStarted' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/jobs/:jobId/collect': {
    operationId: 'collectAuthoredContentWorkOrder',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentWorkOrderReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/recipes/:recipeId/craft': {
    operationId: 'craftAuthoredContentRecipe',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentSupplyReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/tools/:toolId/repair': {
    operationId: 'repairAuthoredContentTool',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentToolRepairReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/exchange/list': {
    operationId: 'listAuthoredContentExchangeOffer',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash', 'offeredItemId', 'offeredQuantity',
        'requestedItemId', 'requestedQuantity'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        offeredItemId: { type: 'string', minLength: 1 },
        offeredQuantity: { type: 'integer', minimum: 1, maximum: 10000 },
        requestedItemId: { type: 'string', minLength: 1 },
        requestedQuantity: { type: 'integer', minimum: 1, maximum: 10000 },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentExchangeReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/exchange/:listingId/cancel': {
    operationId: 'cancelAuthoredContentExchangeOffer',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentExchangeReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/exchange/:listingId/fill': {
    operationId: 'fillAuthoredContentExchangeOffer',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentExchangeReceipt' },
    extraResponses: { 409: CONTENT_STALE_BUNDLE_RESPONSE },
  },
  'POST /v1/content/:namespace/instances': {
    operationId: 'createContentInstance',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['scopeKind', 'roleId'], properties: {
        scopeKind: { type: 'string', enum: ['personal', 'crew', 'extended_family'] },
        roleId: { type: 'string', minLength: 1 },
        consent: { type: 'boolean' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
  },
  'GET /v1/content/instances/:instanceId': {
    operationId: 'getContentInstance',
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
  },
  'POST /v1/content/instances/:instanceId/join': {
    operationId: 'joinContentInstance',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedRevision', 'roleId'], properties: {
        expectedRevision: { type: 'integer', minimum: 0 }, roleId: { type: 'string', minLength: 1 },
        consent: { type: 'boolean' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
    extraResponses: { 409: CONTENT_STALE_RESPONSE },
  },
  'POST /v1/content/instances/:instanceId/consent': {
    operationId: 'setContentConsent',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedRevision', 'on'], properties: {
        expectedRevision: { type: 'integer', minimum: 0 }, on: { type: 'boolean' },
      } },
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
    extraResponses: { 409: CONTENT_STALE_RESPONSE },
  },
  'POST /v1/content/instances/:instanceId/act': {
    operationId: 'actOnContentInstance',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedRevision', 'actionId'], properties: {
        expectedRevision: { type: 'integer', minimum: 0 }, actionId: { type: 'string', minLength: 1 },
        answer: { type: 'string' }, choiceId: { type: 'string', minLength: 1 },
      }, not: { required: ['answer', 'choiceId'] } },
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
    extraResponses: { 409: CONTENT_STALE_RESPONSE },
  },
  'POST /v1/content/instances/:instanceId/leave': {
    operationId: 'leaveContentInstance',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedRevision'], properties: { expectedRevision: { type: 'integer', minimum: 0 } } },
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
    extraResponses: { 409: CONTENT_STALE_RESPONSE },
  },
  'POST /v1/content/instances/:instanceId/claim': {
    operationId: 'claimContentRewards',
    requestSchema: { type: 'object', additionalProperties: false,
      required: ['expectedRevision'], properties: { expectedRevision: { type: 'integer', minimum: 0 } } },
    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },
    extraResponses: { 409: CONTENT_STALE_RESPONSE },
  },
  'POST /v1/worldgraph/items/:itemId/assign-current-character': worldGraphMutation(
    'assignWorldGraphItemToCurrentCharacter',
  ),
  'GET /v1/worldgraph/inventory': worldGraphRead(
    'getWorldGraphInventory', '#/components/schemas/WorldGraphInventory',
  ),
  'GET /v1/worldgraph/recipes': worldGraphRead(
    'getWorldGraphRecipes', '#/components/schemas/WorldGraphRecipeCatalog',
  ),
  'POST /v1/worldgraph/recipes/:recipeId/craft': worldGraphMutation('craftWorldGraphRecipe'),
  'POST /v1/worldgraph/recipes/:recipeId/salvage/:carId': worldGraphMutation('salvageCarWithWorldGraphRecipe'),
  'GET /v1/worldgraph/mysteries': worldGraphRead(
    'getWorldGraphMysteries', '#/components/schemas/WorldGraphMysteryDiscovery',
  ),
  'POST /v1/worldgraph/mysteries/:graphId/start': worldGraphMutation('startWorldGraphMystery'),
  'GET /v1/worldgraph/mysteries/:graphId': worldGraphRead(
    'getWorldGraphMystery', '#/components/schemas/WorldGraphMysteryBoard',
  ),
  'POST /v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover': worldGraphMutation(
    'discoverWorldGraphMysteryNode', WORLDGRAPH_INTERACTION_BODY,
  ),
  'POST /v1/worldgraph/mysteries/:graphId/nodes/:nodeId/complete': worldGraphMutation(
    'completeWorldGraphMysteryNode', WORLDGRAPH_INTERACTION_BODY,
  ),
  'POST /v1/worldgraph/mysteries/:graphId/choices/:nodeId': worldGraphMutation(
    'commitWorldGraphMysteryChoice', WORLDGRAPH_CHOICE_BODY,
  ),
  'POST /v1/worldgraph/mysteries/:graphId/cancel': worldGraphMutation(
    'cancelWorldGraphMystery', WORLDGRAPH_MYSTERY_CANCEL_BODY,
  ),
  'GET /v1/worldgraph/operations': worldGraphRead(
    'getWorldGraphOperations', '#/components/schemas/WorldGraphOperationDiscovery',
  ),
  'POST /v1/worldgraph/operations/:graphId/:operationNodeId/open': worldGraphMutation(
    'openWorldGraphOperation',
  ),
  'GET /v1/worldgraph/operations/:operationId': worldGraphRead(
    'getWorldGraphOperation', '#/components/schemas/WorldGraphOperationBoard',
  ),
  'GET /v1/worldgraph/operations/:operationId/role': worldGraphRead(
    'getWorldGraphOperationRole', '#/components/schemas/WorldGraphRoleBoard',
  ),
  'POST /v1/worldgraph/operations/:operationId/roles/:roleId': worldGraphMutation(
    'assignWorldGraphOperationRole',
  ),
  'POST /v1/worldgraph/operations/:operationId/contributions/:nodeId': worldGraphMutation(
    'contributeToWorldGraphOperation', WORLDGRAPH_INTERACTION_BODY,
  ),
  'POST /v1/worldgraph/operations/:operationId/complete': worldGraphMutation(
    'completeWorldGraphOperation',
  ),
  'POST /v1/worldgraph/operations/:operationId/cancel': worldGraphMutation(
    'cancelWorldGraphOperation',
  ),
};

const AGENT_SCHEMAS = {
  ContentGateState: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'label', 'passed'],
    properties: {
      kind: { type: 'string', enum: [
        'party_role', 'at_location', 'level_at_least', 'mastery_at_least', 'path_is',
        'skill_owned', 'discipline_at_least', 'honor_at_least', 'honor_at_most',
        'underworld_standing_at_least', 'crew_membership', 'season_phase_is',
        'source_claim', 'source_exhausted', 'inventory_cap', 'materials',
        'skill_level', 'job_active', 'facility_location', 'tool_missing', 'tool_broken', 'tool_full',
      ] },
      label: { type: 'string' },
      passed: { type: 'boolean' }, current: {}, required: {},
      trackId: { type: 'string' }, pathId: { type: 'string' }, skillId: { type: 'string' },
      disciplineId: { type: 'string' }, npcId: { type: 'string' },
      title: { type: 'string' }, roleId: { type: 'string' }, itemId: { type: 'string' },
      facilityId: { type: 'string' }, toolId: { type: 'string' },
      location: { oneOf: [{ $ref: '#/components/schemas/ContentLocation' }, { type: 'null' }] },
    },
  },
  ContentStoryFlag: {
    type: 'object', additionalProperties: false,
    required: ['key', 'kind', 'value', 'title', 'recordedAt'],
    properties: {
      key: { type: 'string' }, kind: { type: 'string', enum: [
        'npc_ally', 'npc_grudge', 'district_contact', 'witness_spared', 'family_debt',
        'case_evidence', 'public_reputation', 'future_scene_variant',
      ] },
      value: { type: 'string' }, title: { type: 'string' },
      recordedAt: { type: 'string', format: 'date-time' },
    },
  },
  ContentAction: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind'],
    properties: {
      id: { type: 'string', minLength: 1 }, kind: { type: 'string' },
      nodeId: { type: 'string' }, title: { type: 'string' }, prompt: { type: ['string', 'null'] },
      options: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['id', 'label', 'available', 'blockedBy'], properties: {
          id: { type: 'string' }, label: { type: 'string' },
          available: { type: 'boolean' },
          blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentGateState' } },
        } } },
    },
  },
  ContentMember: {
    type: 'object', additionalProperties: false,
    required: ['name', 'roleId', 'roleTitle', 'participantKind', 'consented', 'leader', 'isMe'],
    properties: {
      name: { type: 'string' }, roleId: { type: 'string' }, roleTitle: { type: 'string' },
      participantKind: { type: 'string', enum: ['agent', 'human_eligible_non_agent'] },
      consented: { type: 'boolean' }, leader: { type: 'boolean' }, isMe: { type: 'boolean' },
    },
  },
  ContentRole: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'participantKinds', 'consentRequired'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' },
      participantKinds: { type: 'array', items: {
        type: 'string', enum: ['agent', 'human_eligible_non_agent'],
      } },
      consentRequired: { type: 'boolean' },
    },
  },
  ContentOpenRole: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'consentRequired'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, consentRequired: { type: 'boolean' },
    },
  },
  ContentLocation: {
    type: 'object', additionalProperties: false,
    required: ['id', 'districtId', 'title'],
    properties: {
      id: { type: 'string' }, districtId: { type: 'string' }, title: { type: 'string' },
    },
  },
  ContentNode: {
    type: 'object', additionalProperties: false,
    required: ['id', 'type', 'state', 'title'],
    properties: {
      id: { type: 'string' }, type: { type: 'string' }, state: { type: 'string' },
      title: { type: ['string', 'null'] }, prompt: { type: 'string' }, summary: { type: 'string' },
      choiceId: { type: 'string' },
    },
  },
  ContentAward: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'state', 'id', 'title'],
    properties: {
      kind: { type: 'string', enum: ['award_status', 'award_collectible'] },
      state: { type: 'string', enum: ['pending', 'applied', 'held', 'failed'] },
      id: { type: 'string' }, title: { type: 'string' },
    },
  },
  ContentInstance: {
    type: 'object', additionalProperties: false,
    required: ['id', 'namespace', 'version', 'contentHash', 'experienceId', 'title', 'scopeKind',
      'status', 'revision', 'runKey', 'leader', 'members', 'nodes', 'facts', 'actions', 'awards',
      'createdAt', 'startedAt', 'completedAt', 'formingExpiresAt'],
    properties: {
      id: { type: 'string' }, namespace: { type: 'string' },
      version: { type: 'integer', minimum: 1 }, contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      experienceId: { type: 'string' }, title: { type: 'string' },
      scopeKind: { type: 'string', enum: ['personal', 'crew', 'extended_family'] },
      status: { type: 'string', enum: ['forming', 'active', 'completed', 'abandoned'] },
      revision: { type: 'integer', minimum: 0 }, runKey: { type: 'string' },
      leader: { type: 'boolean' },
      members: { type: 'array', items: { $ref: '#/components/schemas/ContentMember' } },
      nodes: { type: 'array', items: { $ref: '#/components/schemas/ContentNode' } },
      facts: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['key', 'value'], properties: { key: { type: 'string' }, value: {} } } },
      actions: { type: 'array', items: { $ref: '#/components/schemas/ContentAction' } },
      awards: { type: 'object', additionalProperties: false,
        required: ['pending', 'applied', 'mine'], properties: {
          pending: { type: 'integer', minimum: 0 }, applied: { type: 'integer', minimum: 0 },
          mine: { type: 'array', items: { $ref: '#/components/schemas/ContentAward' } },
        } },
      createdAt: { type: 'string', format: 'date-time' },
      startedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      formingExpiresAt: { type: ['string', 'null'], format: 'date-time' },
    },
  },
  ContentInstanceSummary: {
    type: 'object', additionalProperties: false,
    required: ['id', 'status', 'revision'],
    properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['forming', 'active', 'completed', 'abandoned'] },
      revision: { type: 'integer', minimum: 0 },
    },
  },
  ContentLobby: {
    type: 'object', additionalProperties: false,
    required: ['id', 'namespace', 'version', 'contentHash', 'experienceId', 'title', 'scopeKind',
      'status', 'revision', 'runKey', 'members', 'openRoles', 'createdAt', 'formingExpiresAt'],
    properties: {
      id: { type: 'string' }, namespace: { type: 'string' },
      version: { type: 'integer', minimum: 1 }, contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      experienceId: { type: 'string' }, title: { type: 'string' },
      scopeKind: { type: 'string', enum: ['personal', 'crew', 'extended_family'] },
      status: { type: 'string', const: 'forming' }, revision: { type: 'integer', minimum: 0 },
      runKey: { type: 'string' },
      members: { type: 'array', items: { $ref: '#/components/schemas/ContentMember' } },
      openRoles: { type: 'array', items: { $ref: '#/components/schemas/ContentOpenRole' } },
      createdAt: { type: 'string', format: 'date-time' },
      formingExpiresAt: { type: ['string', 'null'], format: 'date-time' },
    },
  },
  ContentSupplyItem: {
    type: 'object', additionalProperties: false,
    required: ['itemId', 'title', 'quantity'],
    properties: {
      itemId: { type: 'string' }, title: { type: 'string' },
      quantity: { type: 'integer', minimum: 1 },
    },
  },
  ContentCraftingAction: {
    type: 'object', additionalProperties: false,
    required: ['method', 'path', 'body'],
    properties: {
      method: { type: 'string', const: 'POST' }, path: { type: 'string', pattern: '^/v1/content/' },
      body: { type: 'object', additionalProperties: false, required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    },
  },
  ContentExchangeAction: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'method', 'path', 'body'],
    properties: {
      kind: { type: 'string', enum: ['fill', 'cancel'] },
      method: { type: 'string', const: 'POST' },
      path: { type: 'string', pattern: '^/v1/content/' },
      body: { type: 'object', additionalProperties: false, required: ['expectedContentHash'], properties: {
        expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } },
    },
  },
  ContentExchangeBlock: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'label', 'passed'],
    properties: {
      kind: { type: 'string', enum: [
        'exchange_expired', 'exchange_self', 'materials', 'inventory_cap', 'seller_inventory_cap',
      ] },
      label: { type: 'string' }, passed: { type: 'boolean', const: false },
      itemId: { type: 'string' },
      current: { oneOf: [
        { type: 'integer' }, { type: 'string' }, { type: 'array', items: { type: 'object' } },
      ] },
      incoming: { type: 'integer', minimum: 1 },
      required: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
    },
  },
  ContentExchangeInventoryItem: {
    type: 'object', additionalProperties: false,
    required: ['itemId', 'title', 'available', 'escrowed', 'maxOwned'],
    properties: {
      itemId: { type: 'string' }, title: { type: 'string' },
      available: { type: 'integer', minimum: 0 }, escrowed: { type: 'integer', minimum: 0 },
      maxOwned: { type: 'integer', minimum: 1 },
    },
  },
  ContentExchangeListing: {
    type: 'object', additionalProperties: false,
    required: ['id', 'version', 'contentHash', 'currentVersion', 'seller', 'mine', 'expired',
      'offered', 'requested', 'createdAt', 'expiresAt', 'fillable', 'blockedBy', 'action'],
    properties: {
      id: { type: 'string' }, version: { type: 'integer', minimum: 1 },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      currentVersion: { type: 'boolean' }, seller: { type: 'string' }, mine: { type: 'boolean' },
      expired: { type: 'boolean' },
      offered: { $ref: '#/components/schemas/ContentSupplyItem' },
      requested: { $ref: '#/components/schemas/ContentSupplyItem' },
      createdAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' }, fillable: { type: 'boolean' },
      blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentExchangeBlock' } },
      action: { oneOf: [{ $ref: '#/components/schemas/ContentExchangeAction' }, { type: 'null' }] },
    },
  },
  ContentExchange: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'settlement', 'listingTtlHours', 'maxOpenListingsPerAccount',
      'ownOpenListings', 'items', 'listings'],
    properties: {
      kind: { type: 'string', const: 'authored_barter' },
      settlement: { type: 'string', const: 'item_for_item' },
      listingTtlHours: { type: 'integer', minimum: 1, maximum: 168 },
      maxOpenListingsPerAccount: { type: 'integer', minimum: 1, maximum: 20 },
      ownOpenListings: { type: 'integer', minimum: 0 },
      items: { type: 'array', minItems: 2, items: {
        $ref: '#/components/schemas/ContentExchangeInventoryItem',
      } },
      listings: { type: 'array', items: { $ref: '#/components/schemas/ContentExchangeListing' } },
    },
  },
  ContentInventoryItem: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'category', 'stackable', 'maxOwned', 'quantity', 'escrowed',
      'tradeable', 'ownedAcrossVersions'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, category: { type: 'string' },
      stackable: { type: 'boolean' }, maxOwned: { type: 'integer', minimum: 1 },
      quantity: { type: 'integer', minimum: 0 }, escrowed: { type: 'integer', minimum: 0 },
      tradeable: { type: 'boolean' }, ownedAcrossVersions: { type: 'integer', minimum: 0 },
    },
  },
  ContentArchivedInventoryItem: {
    type: 'object', additionalProperties: false,
    required: ['version', 'contentHash', 'itemId', 'title', 'quantity'],
    properties: {
      version: { type: 'integer', minimum: 1 },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      itemId: { type: 'string' }, title: { type: 'string' },
      quantity: { type: 'integer', minimum: 1 },
    },
  },
  ContentSource: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'epoch', 'epochKey', 'globalRemaining', 'claimed', 'eligible',
      'blockedBy', 'outputs', 'action'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' },
      epoch: { type: 'string', enum: ['day', 'week', 'season'] }, epochKey: { type: 'string' },
      globalRemaining: { type: 'integer', minimum: 0 }, claimed: { type: 'boolean' },
      eligible: { type: 'boolean' },
      blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentGateState' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      action: { $ref: '#/components/schemas/ContentCraftingAction' },
    },
  },
  ContentMissingMaterial: {
    type: 'object', additionalProperties: false,
    required: ['itemId', 'title', 'required', 'owned'],
    properties: {
      itemId: { type: 'string' }, title: { type: 'string' },
      required: { type: 'integer', minimum: 1 }, owned: { type: 'integer', minimum: 0 },
    },
  },
  ContentFacility: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'kind', 'location', 'available'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' },
      kind: { type: 'string', const: 'location_workbench' },
      location: { $ref: '#/components/schemas/ContentLocation' },
      available: { type: 'boolean' },
    },
  },
  ContentToolRequirement: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'itemId', 'owned', 'durabilityCost', 'durabilityRemaining',
      'maxDurability', 'usable'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, itemId: { type: 'string' },
      owned: { type: 'boolean' }, durabilityCost: { type: 'integer', minimum: 1 },
      durabilityRemaining: { type: 'integer', minimum: 0 },
      maxDurability: { type: 'integer', minimum: 1 }, usable: { type: 'boolean' },
    },
  },
  ContentTool: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'itemId', 'owned', 'durabilityRemaining', 'maxDurability',
      'durabilityCost', 'broken', 'repairable', 'blockedBy', 'repairInputs', 'missing',
      'facilities', 'action'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, itemId: { type: 'string' },
      owned: { type: 'boolean' }, durabilityRemaining: { type: 'integer', minimum: 0 },
      maxDurability: { type: 'integer', minimum: 1 },
      durabilityCost: { type: 'integer', minimum: 1 }, broken: { type: 'boolean' },
      repairable: { type: 'boolean' },
      blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentGateState' } },
      repairInputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      missing: { type: 'array', items: { $ref: '#/components/schemas/ContentMissingMaterial' } },
      facilities: { type: 'array', items: { $ref: '#/components/schemas/ContentFacility' } },
      action: { $ref: '#/components/schemas/ContentCraftingAction' },
    },
  },
  ContentArchivedTool: {
    type: 'object', additionalProperties: false,
    required: ['version', 'contentHash', 'id', 'title', 'itemId', 'durabilityRemaining',
      'maxDurability', 'broken'],
    properties: {
      version: { type: 'integer', minimum: 1 },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      id: { type: 'string' }, title: { type: 'string' }, itemId: { type: 'string' },
      durabilityRemaining: { type: 'integer', minimum: 0 },
      maxDurability: { type: 'integer', minimum: 1 }, broken: { type: 'boolean' },
    },
  },
  ContentRecipe: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'craftable', 'blockedBy', 'inputs', 'outputs', 'missing',
      'facilities', 'tools', 'action'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, craftable: { type: 'boolean' },
      blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentGateState' } },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      missing: { type: 'array', items: { $ref: '#/components/schemas/ContentMissingMaterial' } },
      facilities: { type: 'array', items: { $ref: '#/components/schemas/ContentFacility' } },
      tools: { type: 'array', items: { $ref: '#/components/schemas/ContentToolRequirement' } },
      action: { $ref: '#/components/schemas/ContentCraftingAction' },
    },
  },
  ContentSkillProgress: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'xp', 'level', 'maxLevel', 'nextLevelXp'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, xp: { type: 'integer', minimum: 0 },
      level: { type: 'integer', minimum: 0 }, maxLevel: { type: 'integer', minimum: 1 },
      nextLevelXp: { type: ['integer', 'null'], minimum: 1 },
    },
  },
  ContentArchivedSkillProgress: {
    type: 'object', additionalProperties: false,
    required: ['version', 'contentHash', 'id', 'title', 'xp', 'level', 'maxLevel'],
    properties: {
      version: { type: 'integer', minimum: 1 },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      id: { type: 'string' }, title: { type: 'string' }, xp: { type: 'integer', minimum: 1 },
      level: { type: 'integer', minimum: 0 }, maxLevel: { type: 'integer', minimum: 1 },
    },
  },
  ContentWorkOrderSkill: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'xpReward'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, xpReward: { type: 'integer', minimum: 1 },
      minLevel: { type: 'integer', minimum: 0 }, currentLevel: { type: 'integer', minimum: 0 },
    },
  },
  ContentWorkOrder: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'durationSeconds', 'startable', 'blockedBy', 'inputs', 'outputs',
      'missing', 'facilities', 'tools', 'skill', 'action'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, durationSeconds: { type: 'integer', minimum: 1 },
      startable: { type: 'boolean' },
      blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentGateState' } },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      missing: { type: 'array', items: { $ref: '#/components/schemas/ContentMissingMaterial' } },
      facilities: { type: 'array', items: { $ref: '#/components/schemas/ContentFacility' } },
      tools: { type: 'array', items: { $ref: '#/components/schemas/ContentToolRequirement' } },
      skill: { $ref: '#/components/schemas/ContentWorkOrderSkill' },
      action: { $ref: '#/components/schemas/ContentCraftingAction' },
    },
  },
  ContentActiveWorkOrder: {
    type: 'object', additionalProperties: false,
    required: ['id', 'jobId', 'title', 'version', 'contentHash', 'status', 'ready',
      'durationSeconds', 'startedAt', 'readyAt', 'secondsRemaining', 'inputs', 'outputs',
      'facilities', 'tools', 'skill', 'action'],
    properties: {
      id: { type: 'string' }, jobId: { type: 'string' }, title: { type: 'string' },
      version: { type: 'integer', minimum: 1 },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      status: { type: 'string', enum: ['working', 'ready'] }, ready: { type: 'boolean' },
      durationSeconds: { type: 'integer', minimum: 1 },
      startedAt: { type: 'string', format: 'date-time' }, readyAt: { type: 'string', format: 'date-time' },
      secondsRemaining: { type: 'integer', minimum: 0 },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      facilities: { type: 'array', items: { $ref: '#/components/schemas/ContentFacility' } },
      tools: { type: 'array', items: { $ref: '#/components/schemas/ContentToolRequirement' } },
      skill: { $ref: '#/components/schemas/ContentWorkOrderSkill' },
      action: { $ref: '#/components/schemas/ContentCraftingAction' },
    },
  },
  ContentWorkshop: {
    type: 'object', additionalProperties: false,
    required: ['namespace', 'version', 'contentHash', 'title', 'inventory', 'archivedInventory',
      'skills', 'archivedSkills', 'facilities', 'tools', 'archivedTools',
      'activeJob', 'sources', 'recipes', 'jobs'],
    properties: {
      namespace: { type: 'string' }, version: { type: 'integer', minimum: 1 },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, title: { type: 'string' },
      inventory: { type: 'array', items: { $ref: '#/components/schemas/ContentInventoryItem' } },
      archivedInventory: { type: 'array', items: { $ref: '#/components/schemas/ContentArchivedInventoryItem' } },
      skills: { type: 'array', items: { $ref: '#/components/schemas/ContentSkillProgress' } },
      archivedSkills: { type: 'array', items: { $ref: '#/components/schemas/ContentArchivedSkillProgress' } },
      facilities: { type: 'array', items: { $ref: '#/components/schemas/ContentFacility' } },
      tools: { type: 'array', items: { $ref: '#/components/schemas/ContentTool' } },
      archivedTools: { type: 'array', items: { $ref: '#/components/schemas/ContentArchivedTool' } },
      activeJob: { oneOf: [{ $ref: '#/components/schemas/ContentActiveWorkOrder' }, { type: 'null' }] },
      sources: { type: 'array', items: { $ref: '#/components/schemas/ContentSource' } },
      recipes: { type: 'array', items: { $ref: '#/components/schemas/ContentRecipe' } },
      jobs: { type: 'array', items: { $ref: '#/components/schemas/ContentWorkOrder' } },
      exchange: { $ref: '#/components/schemas/ContentExchange' },
    },
  },
  ContentSupplyReceiptData: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind', 'actionId', 'inputs', 'outputs'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string', enum: ['source', 'recipe'] },
      actionId: { type: 'string' }, epochKey: { type: 'string' },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
    },
  },
  ContentSupplyReceipt: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'ok', 'receipt', 'workshop'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ok: { type: 'boolean' }, receipt: { $ref: '#/components/schemas/ContentSupplyReceiptData' },
      workshop: { $ref: '#/components/schemas/ContentWorkshop' },
    },
  },
  ContentExchangeListReceiptData: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind', 'contentHash', 'offered', 'requested', 'expiresAt'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string', const: 'exchange_list' },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      offered: { $ref: '#/components/schemas/ContentSupplyItem' },
      requested: { $ref: '#/components/schemas/ContentSupplyItem' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  },
  ContentExchangeCancelReceiptData: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind', 'contentHash', 'returned'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string', const: 'exchange_cancel' },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      returned: { $ref: '#/components/schemas/ContentSupplyItem' },
    },
  },
  ContentExchangeFillReceiptData: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind', 'contentHash', 'received', 'delivered', 'seller'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string', const: 'exchange_fill' },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      received: { $ref: '#/components/schemas/ContentSupplyItem' },
      delivered: { $ref: '#/components/schemas/ContentSupplyItem' }, seller: { type: 'string' },
    },
  },
  ContentExchangeReceipt: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'ok', 'receipt', 'workshop'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ok: { type: 'boolean' },
      receipt: { oneOf: [
        { $ref: '#/components/schemas/ContentExchangeListReceiptData' },
        { $ref: '#/components/schemas/ContentExchangeCancelReceiptData' },
        { $ref: '#/components/schemas/ContentExchangeFillReceiptData' },
      ] },
      workshop: { $ref: '#/components/schemas/ContentWorkshop' },
    },
  },
  ContentToolRepairResult: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'itemId', 'durabilityBefore', 'durabilityAfter', 'maxDurability'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' }, itemId: { type: 'string' },
      durabilityBefore: { type: 'integer', minimum: 0 },
      durabilityAfter: { type: 'integer', minimum: 1 },
      maxDurability: { type: 'integer', minimum: 1 },
    },
  },
  ContentToolRepairReceiptData: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind', 'actionId', 'contentHash', 'inputs', 'tool'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string', const: 'tool_repair' },
      actionId: { type: 'string' },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      tool: { $ref: '#/components/schemas/ContentToolRepairResult' },
    },
  },
  ContentToolRepairReceipt: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'ok', 'receipt', 'workshop'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ok: { type: 'boolean' },
      receipt: { $ref: '#/components/schemas/ContentToolRepairReceiptData' },
      workshop: { $ref: '#/components/schemas/ContentWorkshop' },
    },
  },
  ContentWorkOrderResultSkill: {
    type: 'object', additionalProperties: false,
    required: ['id', 'title', 'xpAwarded', 'xp', 'level', 'maxLevel'],
    properties: {
      id: { type: 'string' }, title: { type: 'string' },
      xpAwarded: { type: 'integer', minimum: 0 }, xp: { type: 'integer', minimum: 0 },
      level: { type: 'integer', minimum: 0 }, maxLevel: { type: 'integer', minimum: 1 },
    },
  },
  ContentWorkOrderReceiptData: {
    type: 'object', additionalProperties: false,
    required: ['id', 'kind', 'actionId', 'contentHash', 'inputs', 'outputs', 'skill'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string', const: 'job' }, actionId: { type: 'string' },
      contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/ContentSupplyItem' } },
      skill: { $ref: '#/components/schemas/ContentWorkOrderResultSkill' },
    },
  },
  ContentWorkOrderStarted: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'ok', 'run', 'workshop'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ok: { type: 'boolean' }, run: { $ref: '#/components/schemas/ContentActiveWorkOrder' },
      workshop: { $ref: '#/components/schemas/ContentWorkshop' },
    },
  },
  ContentWorkOrderReceipt: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'ok', 'receipt', 'workshop'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ok: { type: 'boolean' }, receipt: { $ref: '#/components/schemas/ContentWorkOrderReceiptData' },
      workshop: { $ref: '#/components/schemas/ContentWorkshop' },
    },
  },
  ContentStaleBundleResponse: {
    type: 'object', additionalProperties: false,
    required: ['error', 'message', 'workshop'],
    properties: {
      error: { type: 'string', const: 'stale_content' }, message: { type: 'string' },
      workshop: { $ref: '#/components/schemas/ContentWorkshop' },
    },
  },
  ContentBoard: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'experiences', 'lobbies', 'instances', 'storyFlags', 'crafting'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      experiences: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['namespace', 'version', 'contentHash', 'experienceId', 'title', 'location',
          'runPolicy', 'runKey', 'availableHere', 'eligible', 'blockedBy', 'season',
          'systems', 'scopes', 'roles'], properties: {
          namespace: { type: 'string' }, version: { type: 'integer', minimum: 1 },
          contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, experienceId: { type: 'string' },
          title: { type: 'string' },
          runPolicy: { type: 'string', enum: ['once', 'once_per_season'] },
          runKey: { type: 'string' },
          location: { oneOf: [{ $ref: '#/components/schemas/ContentLocation' }, { type: 'null' }] },
          availableHere: { type: 'boolean' },
          eligible: { type: 'boolean' },
          blockedBy: { type: 'array', items: { $ref: '#/components/schemas/ContentGateState' } },
          season: { oneOf: [{ type: 'object', additionalProperties: false,
            required: ['index', 'current', 'required', 'daysUntilChange'], properties: {
              index: { type: 'integer' }, current: { type: 'string' }, required: { type: 'string' },
              daysUntilChange: { type: 'integer', minimum: 1 },
            } }, { type: 'null' }] },
          systems: { type: 'array', items: { type: 'string' } },
          scopes: { type: 'array', items: { type: 'string', enum: ['personal', 'crew', 'extended_family'] } },
          roles: { type: 'array', items: { $ref: '#/components/schemas/ContentRole' } },
        } } },
      lobbies: { type: 'array', items: { $ref: '#/components/schemas/ContentLobby' } },
      instances: { type: 'array', items: { $ref: '#/components/schemas/ContentInstance' } },
      storyFlags: { type: 'array', items: { $ref: '#/components/schemas/ContentStoryFlag' } },
      crafting: { type: 'array', items: { $ref: '#/components/schemas/ContentWorkshop' } },
    },
  },
  ContentClaim: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'id', 'title'],
    properties: {
      kind: { type: 'string', enum: ['award_status', 'award_collectible'] },
      id: { type: 'string' }, title: { type: 'string' },
    },
  },
  ContentReceipt: {
    type: 'object', additionalProperties: false,
    required: ['character', 'events', 'instance'],
    properties: {
      character: { type: ['object', 'null'], additionalProperties: true },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
      ok: { type: 'boolean' }, left: { type: 'boolean' },
      instance: { oneOf: [
        { $ref: '#/components/schemas/ContentInstance' },
        { $ref: '#/components/schemas/ContentLobby' },
        { $ref: '#/components/schemas/ContentInstanceSummary' },
      ] },
      claimed: { type: 'array', items: { $ref: '#/components/schemas/ContentClaim' } },
    },
  },
  ContentStaleResponse: {
    type: 'object', additionalProperties: false,
    required: ['error', 'message', 'instance'],
    properties: {
      error: { type: 'string', const: 'stale_instance' }, message: { type: 'string' },
      instance: { oneOf: [
        { $ref: '#/components/schemas/ContentInstance' },
        { $ref: '#/components/schemas/ContentLobby' },
        { $ref: '#/components/schemas/ContentInstanceSummary' },
      ] },
    },
  },
  WorldGraphError: {
    type: 'object', required: ['error'],
    properties: { error: { type: 'string' }, message: { type: 'string' } },
  },
  WorldGraphForbiddenError: {
    type: 'object', additionalProperties: false, required: ['error'],
    properties: { error: { type: 'string', const: 'banned' } },
  },
  WorldGraphRateLimitError: {
    type: 'object', additionalProperties: false, required: ['error', 'retryAfter'],
    properties: {
      error: { type: 'string', const: 'rate_limited' },
      retryAfter: { type: 'integer', minimum: 1 },
    },
  },
  WorldGraphUnavailableError: {
    type: 'object', additionalProperties: false, required: ['error'],
    properties: { error: { type: 'string', const: 'db_down' } },
  },
  WorldGraphConflictError: {
    type: 'object', additionalProperties: false, required: ['error', 'message'],
    properties: {
      error: { type: 'string', enum: [
        'in_progress', 'contention', 'idempotency_conflict', 'idempotency_in_progress',
        'operation_role_taken', 'operation_choice_conflict', 'choice_committed',
      ] },
      message: { type: 'string' },
    },
  },
  WorldGraphKeyReuseError: {
    type: 'object', additionalProperties: false, required: ['error', 'message'],
    properties: {
      error: { type: 'string', const: 'idempotency_key_reuse' },
      message: { type: 'string' },
    },
  },
  WorldGraphInventoryStack: {
    type: 'object', additionalProperties: false,
    required: ['templateId', 'quality', 'qty', 'createdAt', 'updatedAt'],
    properties: {
      templateId: { type: 'string' }, quality: { type: 'string' },
      qty: { type: 'integer', minimum: 1 },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  WorldGraphInventoryItem: {
    type: 'object', additionalProperties: false,
    required: ['id', 'templateId', 'state', 'escrowed', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' }, templateId: { type: 'string' }, state: { type: 'string' },
      escrowed: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  WorldGraphInventory: {
    type: 'object', additionalProperties: false, required: ['stacks', 'items'],
    properties: {
      stacks: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphInventoryStack' } },
      items: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphInventoryItem' } },
    },
  },
  WorldGraphRecipeEntry: {
    type: 'object', additionalProperties: false,
    required: ['quantity'],
    properties: {
      templateId: { type: 'string' }, assetType: { type: 'string' },
      quantity: { type: 'integer', minimum: 1 }, quality: { type: 'string' },
    },
  },
  WorldGraphRecipeBlocker: {
    type: 'object', additionalProperties: false, required: ['adapter'],
    properties: {
      adapter: { type: 'string', enum: [
        'location', 'level', 'skill', 'owns_car',
        'cash', 'material_quantity', 'item_ownership',
      ] },
      required: { type: ['string', 'number', 'null'] },
      current: { type: ['string', 'number', 'null'] },
      carId: { type: ['string', 'null'] },
      templateId: { type: 'string' }, quality: { type: 'string' },
    },
  },
  WorldGraphRecipe: {
    type: 'object', additionalProperties: false,
    required: ['packageId', 'packageVersion', 'recipeId', 'recipeVersion', 'id', 'title',
      'inputs', 'outputs', 'cashCost', 'available', 'blockedBy'],
    properties: {
      packageId: { type: 'string' }, packageVersion: { type: 'integer', minimum: 1 },
      recipeId: { type: 'string' }, recipeVersion: { type: 'integer', minimum: 1 },
      id: { type: 'string' }, title: { type: 'string' },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphRecipeEntry' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphRecipeEntry' } },
      cashCost: { type: 'integer', minimum: 0 }, available: { type: 'boolean' },
      blockedBy: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphRecipeBlocker' } },
    },
  },
  WorldGraphRecipeCatalog: {
    type: 'object', additionalProperties: false, required: ['recipes'],
    properties: { recipes: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphRecipe' } } },
  },
  WorldGraphMysterySummary: {
    type: 'object', additionalProperties: false,
    required: ['graphId', 'version', 'season', 'title', 'started', 'status'],
    properties: {
      graphId: { type: 'string' }, version: { type: 'integer', minimum: 1 },
      season: { type: ['string', 'null'] }, title: { type: 'string' },
      started: { type: 'boolean' }, status: { type: 'string' }, instanceId: { type: 'string' },
    },
  },
  WorldGraphMysteryDiscovery: {
    type: 'object', additionalProperties: false, required: ['mysteries'],
    properties: { mysteries: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphMysterySummary' } } },
  },
  WorldGraphMysteryNode: {
    type: 'object', additionalProperties: false,
    required: ['id', 'type', 'title', 'status', 'available', 'blockedBy'],
    properties: {
      id: { type: 'string' }, type: { type: 'string' }, title: { type: 'string' },
      status: { type: 'string' }, available: { type: 'boolean' },
      blockedBy: { type: 'array', items: { type: 'object' } },
      options: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['id', 'title'], properties: { id: { type: 'string' }, title: { type: 'string' } } } },
    },
  },
  WorldGraphMysteryBoard: {
    type: 'object', additionalProperties: false,
    required: ['instanceId', 'graph', 'status', 'createdAt', 'nodes', 'choices'],
    properties: {
      instanceId: { type: 'string' },
      graph: { type: 'object', additionalProperties: false,
        required: ['id', 'version', 'season'], properties: {
          id: { type: 'string' }, version: { type: 'integer', minimum: 1 },
          season: { type: ['string', 'null'] },
        } },
      status: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      failedAt: { type: ['string', 'null'], format: 'date-time' },
      canceledAt: { type: ['string', 'null'], format: 'date-time' },
      nodes: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphMysteryNode' } },
      choices: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['nodeId', 'choiceId'], properties: {
          nodeId: { type: 'string' }, choiceId: { type: 'string' },
        } } },
    },
  },
  WorldGraphOperationSummary: {
    type: 'object', additionalProperties: false,
    required: ['graphId', 'version', 'operationNodeId', 'title', 'minimumDistinctAccounts',
      'roles', 'available', 'blockedBy'],
    properties: {
      graphId: { type: 'string' }, version: { type: 'integer', minimum: 1 },
      operationNodeId: { type: 'string' }, title: { type: 'string' },
      minimumDistinctAccounts: { type: 'integer', minimum: 1 },
      roles: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['roleId', 'title'], properties: {
          roleId: { type: 'string' }, title: { type: 'string' },
        } } },
      available: { type: 'boolean' },
      blockedBy: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['code'], properties: { code: { type: 'string' } } } },
      operationId: { type: 'string' }, status: { type: 'string' },
    },
  },
  WorldGraphOperationDiscovery: {
    type: 'object', additionalProperties: false, required: ['operations'],
    properties: { operations: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphOperationSummary' } } },
  },
  WorldGraphOperationNode: {
    type: 'object', additionalProperties: false,
    required: ['id', 'type', 'title', 'status', 'completedAt'],
    properties: {
      id: { type: 'string' }, type: { type: 'string' }, title: { type: 'string' },
      status: { type: 'string' }, completedAt: { type: ['string', 'null'], format: 'date-time' },
      privateEvidence: { type: 'string' },
    },
  },
  WorldGraphOperationGraph: {
    type: 'object', additionalProperties: false,
    required: ['id', 'version', 'operationNodeId'], properties: {
      id: { type: 'string' }, version: { type: 'integer', minimum: 1 }, operationNodeId: { type: 'string' },
    },
  },
  WorldGraphOperationBoard: {
    type: 'object', additionalProperties: false,
    required: ['operationId', 'graph', 'status', 'closeReason', 'createdAt', 'activatedAt',
      'completedAt', 'canceledAt', 'abandonedAt', 'roles', 'filledRoleCount',
      'requiredRoleCount', 'nodes'],
    properties: {
      operationId: { type: 'string' }, graph: { $ref: '#/components/schemas/WorldGraphOperationGraph' },
      status: { type: 'string' }, closeReason: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      activatedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      canceledAt: { type: ['string', 'null'], format: 'date-time' },
      abandonedAt: { type: ['string', 'null'], format: 'date-time' },
      roles: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['roleId', 'title', 'filled', 'contributions'], properties: {
          roleId: { type: 'string' }, title: { type: 'string' }, filled: { type: 'boolean' },
          contributions: { type: 'integer', minimum: 0 },
        } } },
      filledRoleCount: { type: 'integer', minimum: 0 },
      requiredRoleCount: { type: 'integer', minimum: 1 },
      nodes: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphOperationNode' } },
    },
  },
  WorldGraphRoleBoard: {
    type: 'object', additionalProperties: false,
    required: ['operationId', 'graph', 'status', 'closeReason', 'createdAt', 'activatedAt',
      'completedAt', 'canceledAt', 'abandonedAt', 'role', 'nodes'],
    properties: {
      operationId: { type: 'string' }, graph: { $ref: '#/components/schemas/WorldGraphOperationGraph' },
      status: { type: 'string' }, closeReason: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      activatedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      canceledAt: { type: ['string', 'null'], format: 'date-time' },
      abandonedAt: { type: ['string', 'null'], format: 'date-time' },
      role: { type: 'object', additionalProperties: false, required: ['roleId'],
        properties: { roleId: { type: 'string' } } },
      nodes: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphOperationNode' } },
    },
  },
  WorldGraphMutationEntry: {
    type: 'object', additionalProperties: false,
    properties: {
      id: { type: 'string' }, templateId: { type: 'string' }, assetType: { type: 'string' },
      quantity: { type: 'integer' }, quality: { type: 'string' }, qty: { type: 'integer' },
      delta: { type: 'integer' }, state: { type: 'string' }, escrowed: { type: 'boolean' },
      createdAt: { type: ['string', 'null'], format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
      consumedAt: { type: ['string', 'null'], format: 'date-time' },
      modelId: { type: 'string' }, trimId: { type: 'string' }, damage: { type: 'integer' },
    },
  },
  WorldGraphMutationEffect: {
    type: 'object', additionalProperties: false, required: ['kind'],
    properties: {
      kind: { type: 'string' }, nodeId: { type: 'string' }, recipientRoleId: { type: 'string' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      item: { $ref: '#/components/schemas/WorldGraphMutationEntry' },
    },
  },
  WorldGraphMutationGraph: {
    type: 'object', additionalProperties: false, required: ['id', 'version'],
    properties: {
      id: { type: 'string' }, version: { type: 'integer', minimum: 1 },
      season: { type: ['string', 'null'] }, operationNodeId: { type: 'string' },
    },
  },
  WorldGraphMutationNode: {
    type: 'object', additionalProperties: false, required: ['id', 'status'],
    properties: {
      id: { type: 'string' }, status: { type: 'string' },
      discoveredAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
    },
  },
  WorldGraphMutationChoice: {
    type: 'object', additionalProperties: false, required: ['id', 'committedAt'],
    properties: {
      id: { type: 'string' }, committedAt: { type: 'string', format: 'date-time' },
    },
  },
  WorldGraphMutationAssignment: {
    type: 'object', additionalProperties: false, required: ['roleId', 'assignedAt'],
    properties: {
      roleId: { type: 'string' }, assignedAt: { type: 'string', format: 'date-time' },
    },
  },
  WorldGraphMutationContribution: {
    type: 'object', additionalProperties: false, required: ['nodeId', 'roleId', 'completedAt'],
    properties: {
      nodeId: { type: 'string' }, roleId: { type: 'string' },
      completedAt: { type: 'string', format: 'date-time' },
    },
  },
  WorldGraphMutationReceipt: {
    type: 'object', additionalProperties: false, required: ['ok'],
    properties: {
      ok: { type: 'boolean' }, kind: { type: 'string' },
      recipe: { type: 'object', additionalProperties: false,
        required: ['packageId', 'packageVersion', 'recipeId', 'recipeVersion'], properties: {
          packageId: { type: 'string' }, packageVersion: { type: 'integer', minimum: 1 },
          recipeId: { type: 'string' }, recipeVersion: { type: 'integer', minimum: 1 },
        } },
      cashCost: { type: 'integer', minimum: 0 }, cashAfter: { type: 'integer', minimum: 0 },
      inputs: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphMutationEntry' } },
      outputs: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphMutationEntry' } },
      car: { $ref: '#/components/schemas/WorldGraphMutationEntry' },
      instanceId: { type: 'string' }, operationId: { type: 'string' },
      graph: { $ref: '#/components/schemas/WorldGraphMutationGraph' },
      status: { type: 'string' }, closeReason: { type: ['string', 'null'] },
      createdAt: { type: ['string', 'null'], format: 'date-time' },
      activatedAt: { type: ['string', 'null'], format: 'date-time' },
      completedAt: { type: ['string', 'null'], format: 'date-time' },
      failedAt: { type: ['string', 'null'], format: 'date-time' },
      canceledAt: { type: ['string', 'null'], format: 'date-time' },
      abandonedAt: { type: ['string', 'null'], format: 'date-time' },
      releasedEscrowCount: { type: 'integer', minimum: 0 },
      node: { $ref: '#/components/schemas/WorldGraphMutationNode' },
      choice: { $ref: '#/components/schemas/WorldGraphMutationChoice' },
      assignment: { $ref: '#/components/schemas/WorldGraphMutationAssignment' },
      contribution: { $ref: '#/components/schemas/WorldGraphMutationContribution' },
      effects: { type: 'array', items: { $ref: '#/components/schemas/WorldGraphMutationEffect' } },
      item: { $ref: '#/components/schemas/WorldGraphMutationEntry' },
    },
  },
  AgentEV: {
    type: 'object', additionalProperties: false,
    required: ['cash', 'treasury', 'inventory', 'liability', 'respect', 'confidence', 'basis'],
    properties: {
      cash: { type: 'number' }, treasury: { type: 'number' }, inventory: { type: 'number' },
      liability: { type: 'number' }, respect: { type: 'number' },
      confidence: { type: 'number', minimum: 0, maximum: 1 }, basis: { type: 'string' },
    },
  },
  AgentAction: {
    type: 'object', additionalProperties: true,
    required: ['id', 'kind', 'method', 'path', 'body', 'executable', 'score', 'ev'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string' }, label: { type: 'string' },
      planId: { type: 'string' }, rank: { type: 'integer', minimum: 1 }, score: { type: 'number' },
      ev: { $ref: '#/components/schemas/AgentEV' },
      method: { type: 'string', enum: ['POST', 'PUT', 'DELETE'] },
      path: { type: 'string', pattern: '^/v1/' }, body: { type: 'object' }, executable: { type: 'boolean' },
      cost: { type: 'object' }, reward: { type: 'object' }, risk: { type: 'object' },
      blockedBy: { type: 'array', items: { type: 'object' } },
    },
  },
  AgentPlan: {
    type: 'object', additionalProperties: true,
    required: ['id', 'kind', 'label', 'score', 'ev', 'status', 'nextActionId', 'refreshAfterStep', 'route'],
    properties: {
      id: { type: 'string' }, kind: { type: 'string' }, label: { type: 'string' },
      rank: { type: 'integer', minimum: 1 }, score: { type: 'number' },
      ev: { $ref: '#/components/schemas/AgentEV' }, status: { type: 'string' },
      nextActionId: { type: ['string', 'null'] }, refreshAfterStep: { type: 'boolean' },
      route: { type: 'array', items: { type: 'object' } },
      availableAt: { type: 'string', format: 'date-time' },
    },
  },
  AgentExplorationNext: {
    type: 'object', additionalProperties: false,
    required: ['systemId', 'system', 'name', 'tab', 'hook', 'at', 'mode', 'reason', 'evidence'],
    properties: {
      systemId: { type: 'string' }, system: { type: 'string' }, name: { type: 'string' },
      tab: { type: 'string' }, hook: { type: 'string' }, at: { type: 'integer', minimum: 1 },
      mode: { type: 'string', enum: ['solo', 'organization', 'social'] },
      reason: { type: 'string', enum: ['earliest_overdue_unlock'] },
      evidence: { type: 'object', additionalProperties: false, required: ['visited', 'source'], properties: {
        visited: { type: 'boolean', const: false }, source: { type: 'null' },
      } },
    },
  },
  AgentExploration: {
    type: 'object', additionalProperties: false,
    required: ['catalog', 'progress', 'next', 'blocked'],
    properties: {
      catalog: { type: 'object', additionalProperties: false, required: ['scope', 'version', 'count'], properties: {
        scope: { type: 'string', const: 'engagement_systems' }, version: { type: 'integer', const: 1 },
        count: { type: 'integer', const: 40 },
      } },
      progress: { type: 'object', additionalProperties: false, required: ['visited', 'eligible', 'remaining'], properties: {
        visited: { type: 'integer', minimum: 0, maximum: 40 },
        eligible: { type: 'integer', minimum: 0, maximum: 40 },
        remaining: { type: 'integer', minimum: 0, maximum: 40 },
      } },
      next: { oneOf: [{ $ref: '#/components/schemas/AgentExplorationNext' }, { type: 'null' }] },
      blocked: { type: 'object', additionalProperties: false,
        required: ['level', 'resource', 'status', 'social', 'policy'], properties: {
          level: { type: 'integer', minimum: 0 }, resource: { type: 'integer', minimum: 0 },
          status: { type: 'integer', minimum: 0 }, social: { type: 'integer', minimum: 0 },
          policy: { type: 'integer', minimum: 0 },
        } },
    },
  },
  AgentTurn: {
    type: 'object', additionalProperties: false,
    required: ['turnId', 'observedAt', 'state', 'extraction', 'policy', 'ranking', 'recommendedActionId',
      'actions', 'blockedActions', 'plans', 'nextWakeAt', 'opportunities', 'exploration'],
    properties: {
      turnId: { type: 'string', pattern: '^turn_[0-9a-f]{64}$' },
      observedAt: { type: 'string', format: 'date-time' }, state: { type: 'object' },
      extraction: { type: 'object', required: ['stage', 'wallet', 'minted', 'canExtract'], properties: {
        stage: { type: 'string', enum: ['wallet_required', 'character_mint_required', 'rail_dormant', 'ready'] },
        wallet: { type: ['string', 'null'] }, minted: { type: 'boolean' }, canExtract: { type: 'boolean' },
      } },
      coach: { type: ['object', 'null'] }, coachPlan: { type: 'array', items: { type: 'object' } },
      policy: { type: 'object' }, ranking: { type: 'object' },
      recommendedActionId: { type: ['string', 'null'] },
      actions: { type: 'array', items: { $ref: '#/components/schemas/AgentAction' } },
      blockedActions: { type: 'array', items: { $ref: '#/components/schemas/AgentAction' } },
      plans: { type: 'array', items: { $ref: '#/components/schemas/AgentPlan' } },
      nextWakeAt: { type: ['string', 'null'], format: 'date-time' }, opportunities: { type: 'object' },
      exploration: { $ref: '#/components/schemas/AgentExploration' },
    },
  },
  AgentActReceipt: {
    type: 'object', additionalProperties: false,
    required: ['actionId', 'result', 'turn', 'refreshRequired'],
    properties: {
      actionId: { type: 'string' }, result: { type: 'object' },
      turn: { oneOf: [{ $ref: '#/components/schemas/AgentTurn' }, { type: 'null' }] },
      refreshRequired: { type: 'boolean' },
    },
  },
};

const tagOf = (url) => {
  const seg = url.replace(/^\/v1\//, '').replace(/^\//, '').split('/')[0] || 'root';
  return seg.startsWith(':') ? 'root' : seg;
};
const oapiPath = (url) => url.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
const paramsOf = (url) => (url.match(/:([A-Za-z0-9_]+)/g) || []).map((p) => p.slice(1));

// info.version is DERIVED from package.json (bulletproof audit, SemVer): a hardcoded literal here sat
// frozen at '1.0.0' through real contract changes (retirements, new flows), so an agent caching the
// contract could never detect that it moved. The practice, stated where the derivation lives: bump
// package.json minor on new surface, major on a route retirement/breaking board change — the version
// an agent reads then IS the version the repo ships. Read lazily so a missing file degrades, not throws.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
let pkgVersion;
export function appVersion() {
  if (!pkgVersion) {
    try { pkgVersion = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version || '0.0.0'; }
    catch { pkgVersion = '0.0.0'; }
  }
  return pkgVersion;
}

// Build an OpenAPI 3.1 document from the collected [{method, url}] route list.
export function buildOpenApi(routes, { baseUrl = 'https://www.omerta.fun', version = appVersion() } = {}) {
  const paths = {};
  const tagsSeen = new Set();
  for (const r of routes) {
    const { method, url } = r;
    if (DOC_PATHS.has(url)) continue;           // HTML/markdown docs, not JSON API
    if (url.startsWith('/v1/ws')) continue;      // websocket, not HTTP request/response
    // The moderator/admin surface is NOT advertised in the public contract (audit F1): agents have
    // no use for it, and enumerating mod routes + the x-mod-key header only maps the admin surface.
    const isMod = (r.isMod !== undefined) ? r.isMod : url.startsWith('/v1/mod/');
    if (isMod) continue;
    // The single RWA reviewer is a separate operational perimeter, never a player bearer token.
    // Keep privileged reviewer routes out of the public agent contract, like moderator routes.
    if (r.isRwaReviewer) continue;
    const p = oapiPath(url);
    const tag = tagOf(url);
    tagsSeen.add(tag);
    // Security is DERIVED from the route's real preHandler (r.hasAuth), not a URL heuristic — the
    // spec can't drift from enforcement or mask a route that shipped without auth (audit F2). The
    // PUBLIC_PATHS set is only a fallback for callers that don't supply the flag.
    const isPublic = (r.hasAuth !== undefined) ? !r.hasAuth : PUBLIC_PATHS.has(url);
    const security = isPublic ? [] : [{ bearerAuth: [] }];
    const contract = OPERATION_CONTRACTS[`${method} ${url}`];
    const op = {
      tags: [tag],
      summary: `${method} ${url}`,
      ...(contract?.operationId ? { operationId: contract.operationId } : {}),
      security,
      parameters: [
        ...paramsOf(url).map((name) => ({
          name, in: 'path', required: true,
          schema: contract?.pathSchemas?.[name] || { type: 'string' },
        })),
        ...(contract?.requestParameters || []),
      ],
      responses: {
        200: { description: 'OK' },
        400: { description: 'Game error — { error: <stable code>, message }' },
        ...(isPublic ? {} : { 401: { description: 'Missing/invalid token' } }),
        ...(contract?.extraResponses || {}),
      },
    };
    if (contract?.responseSchema) op.responses[200] = {
      description: 'OK',
      ...(contract.responseHeaders ? { headers: contract.responseHeaders } : {}),
      content: { 'application/json': { schema: contract.responseSchema } },
    };
    if (method !== 'GET' && method !== 'DELETE') {
      op.requestBody = { required: !!contract?.requestSchema?.required,
        content: { 'application/json': { schema: contract?.requestSchema || { type: 'object' } } } };
    }
    paths[p] = paths[p] || {};
    paths[p][method.toLowerCase()] = op;
  }
  const tags = [...tagsSeen].sort().map((name) => ({ name, description: TAG_DESC[name] || `${name} endpoints.` }));
  return {
    openapi: '3.1.0',
    info: {
      title: 'OMERTÀ — Agent API',
      version,
      summary: 'A server-authoritative noir mafia RPG with a real, ledgered economy, built for agents.',
      description: 'Autonomous agents are first-class players. See /agents for the quickstart, '
        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. Get an agent '
        + 'key via POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '
        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',
      contact: { url: baseUrl },
    },
    servers: [{ url: baseUrl }],
    tags,
    components: {
      schemas: AGENT_SCHEMAS,
      // Only the player/agent bearer scheme is advertised — the moderator surface is excluded from
      // the public contract entirely (audit F1), so its header name is never disclosed here.
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
          description: 'Player/agent token from /v1/auth/*. Agent tokens (POST /v1/auth/agent-key) throttle at 1/3s.' },
      },
    },
    paths,
  };
}

// The llms.txt discovery index (the emerging LLM-facing standard: a concise markdown map of the
// site's machine-usable resources). Served at GET /llms.txt.
export function llmsTxt({ baseUrl = 'https://www.omerta.fun' } = {}) {
  return `# OMERTÀ

> A server-authoritative, multiplayer noir mafia RPG with a real, ledgered economy.
> Autonomous agents are first-class players: the whole game is a JSON HTTP API with an
> OpenAPI contract, stable error codes, machine-readable rules, and an on-chain $OMR
> extraction rail, which is built but dormant in production. Agents compete in the economy on skill — not by faucets.

## Play as an agent
- [Agent quickstart](${baseUrl}/agents): auth → agent key → create → poll opportunities → act. Extraction setup: link EVM wallet → mint character.
- [Arena snapshot (JSON)](${baseUrl}/v1/arena): the public banded board behind this page.
- [Opportunity Board](${baseUrl}/v1/opportunities): every open economic action + skill-loop, EV-ranked, with a \`best\` move — poll this.
- [Agent Turn v3](${baseUrl}/v1/agent/turn): transparent EV ranking + refresh-safe multi-loop plans + executable next steps + blockers + next wake time in one throttled read.
- Agent Turn v3 also returns the required \`exploration\` coverage object with \`catalog\`, \`progress\`, \`next\`, and \`blocked\`. Its \`exploration.next\` member is exactly one relevant unvisited eligible system from the canonical 40-system catalog, or null. Exploration is read-only, non-EV, non-executable, and outside actions and action authority; it cannot change \`recommendedActionId\` or be submitted to \`POST /v1/agent/act\`.
- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \`{turnId, actionId}\`; success returns the post-action turn, while \`409 stale_turn\` returns a replacement snapshot without executing.
- Agent Alpha is the owner-operated bounded runner in \`tools/agent-alpha.js\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.
- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.
- Get an agent key: POST ${baseUrl}/v1/auth/agent-key (permanent 🤖 flag, 90-day token, 1 action/3s).
- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.

## Machine rulebook
- [Rules](${baseUrl}/v1/rules): crimes, districts, guns, drugs, goods, catalogs, thresholds, paths.
- [Capability catalog](${baseUrl}/v1/catalog): level-gated fronts plus direct Phase 1 world-graph route pointers.

## Phase 1 world graph — deliberate direct play
- [Inventory](${baseUrl}/v1/worldgraph/inventory): conserved account-owned materials and unique items.
- [Recipes](${baseUrl}/v1/worldgraph/recipes): discovered recipes with current cash, material, skill, location, and car blockers. Use the issued recipe and owned-car identifiers with the craft/salvage routes.
- Assign an eligible crafted unique item to the authenticated account's current living character with POST ${baseUrl}/v1/worldgraph/items/:itemId/assign-current-character. The body is empty; the server chooses both owners.
- [Mysteries](${baseUrl}/v1/worldgraph/mysteries): discover and start a graph, read its board, then deliberately discover/complete/choose. Keep the server-issued instanceId so POST /v1/worldgraph/mysteries/:graphId/cancel can recover historical escrow after character replacement. Generic owner/depositor tuples are immutable history, not estate assets: death/replacement never wipes, rewrites, inherits, or duplicates them; release returns once to the exact historical depositor, and an heir cannot drive or claim the old instance. Current play is unique per owner + graph + version; an exact old instance remains release-only after a version bump or package retirement and cannot execute retired content.
- [Crew operations](${baseUrl}/v1/worldgraph/operations): discover/open, read shared or assigned-role boards, claim one role, contribute, then complete or cancel. Shared boards never reveal role-private evidence. Only the authenticated stored opener account can cancel an old-version or retired operation and release its recorded escrow, independent of current Crew membership. The Crew is a historical association, not cancellation authority; recovery never interprets retired nodes, effects, or rewards.
- Every mutation requires a fresh Idempotency-Key; exact retries replay. Missing, foreign, hidden, and otherwise unavailable private identifiers use non-enumerating errors.
- The only cash movement is the exact $300 craft:recipe:hardened_steel sink; all other Phase 1 actions are cash-neutral and every action is $OMR-neutral. item_stacks, permanent item_instances, exact-quality item_events, operation_escrow, and completed zero-cash salvage guards are authority; collection_log is not. Aggregates lock the global item guard before revalidating the living character and locking domain/item rows.
- Operators and server boot run npm run worldgraph:check's same closed executable-definition and exact economy policy over the canonical CORE + AUTOMOTIVE + BELLADONNA manifest. It is separate from the authored-content compiler and content:check.
- These world-graph actions are direct-only. Discovery and boards grant no POST /v1/agent/act authority, and the autonomous queue does not execute them.

## How to earn (skill-based, open to agents)
- Crime grind, kitchen optimization, trade-goods arbitrage across districts (deterministic
  price hash), convoy running/ambush, contract fulfillment (hitman/heist/bodyguard),
  loan sharking, businesses/rackets/territory (lazy-accrual passive income).

## Extraction rail status
- NOT YET OPEN: production runs with no chain configured. The rail is built and devnet-proven;
  it opens when the audit and launch gates clear.
- Once open: link a wallet (SIWE), mint the account (one-time on-chain fee), then POST /v1/withdraw
  signs a full-reserve-backed EIP-712 voucher you claim on-chain (extraction ≤ inflow).

## Fair play
- Agent accounts are excluded from the human anti-Sybil faucets (referrals, social tasks,
  assassin-reputation leaderboard) and throttled harder. Every economic loop is fully open.

## Human reference
- [Playable console](${baseUrl}/): the web client.
- [The Codex](${baseUrl}/wiki): the full rulebook, every system + loop.
`;
}
