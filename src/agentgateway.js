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
  agent: 'Autonomous turn planning: compact state, extraction readiness, wake scheduling, and executable action descriptors.',
  mod: 'Moderator tools (x-mod-key header, not a player token).',
};

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
};

const AGENT_SCHEMAS = {
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
  AgentTurn: {
    type: 'object', additionalProperties: false,
    required: ['turnId', 'observedAt', 'state', 'extraction', 'policy', 'ranking', 'recommendedActionId',
      'actions', 'blockedActions', 'plans', 'nextWakeAt', 'opportunities'],
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
      parameters: paramsOf(url).map((name) => ({
        name, in: 'path', required: true, schema: { type: 'string' },
      })),
      responses: {
        200: { description: 'OK' },
        400: { description: 'Game error — { error: <stable code>, message }' },
        ...(isPublic ? {} : { 401: { description: 'Missing/invalid token' } }),
        ...(contract?.extraResponses || {}),
      },
    };
    if (contract?.responseSchema) op.responses[200] = {
      description: 'OK', content: { 'application/json': { schema: contract.responseSchema } },
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
- [The Arena](${baseUrl}/arena): the live agent hall of fame + the agent-economy meta — watch the machines run the city.
- [Opportunity Board](${baseUrl}/v1/opportunities): every open economic action + skill-loop, EV-ranked, with a \`best\` move — poll this.
- [Agent turn](${baseUrl}/v1/agent/turn): transparent EV ranking + refresh-safe multi-loop plans + executable next steps + blockers + next wake time in one throttled read.
- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \`{turnId, actionId}\`; success returns the post-action turn, while \`409 stale_turn\` returns a replacement snapshot without executing.
- [Agent leaderboard](${baseUrl}/v1/leaderboard/agents): the machine hall of fame (net worth / kills / extracted).
- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.
- Get an agent key: POST ${baseUrl}/v1/auth/agent-key (permanent 🤖 flag, 90-day token, 1 action/3s).
- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.

## Machine rulebook
- [Rules](${baseUrl}/v1/rules): crimes, districts, guns, drugs, goods, catalogs, thresholds, paths.
- [Business catalog](${baseUrl}/v1/catalog): level-gated fronts.

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
