#!/usr/bin/env node
// OMERTÀ — Model Context Protocol server. Exposes the game as MCP tools so ANY MCP-capable agent
// (Claude Desktop, Claude Code, an SDK agent, …) can play natively. It is a thin, stateful proxy
// over the OMERTÀ HTTP API: it holds the session token in memory and forwards tool calls as JSON
// requests. The universal `omerta_request` tool reaches every one of the game's ~279 routes; the
// convenience tools cover the hot path (start → look around → act). Uses the low-level Server API
// (raw JSON Schema, no zod) so it works across SDK versions.
//
// Config (env): OMERTA_BASE_URL (default https://www.omerta.fun), OMERTA_TOKEN (optional pre-set
// token), OMERTA_INVITE (optional closed-alpha invite code used by omerta_start).
//
// Install:  nothing — an MCP client runs it via `npx -y omerta-mcp`. (For local dev: npm install.)
// Run:      OMERTA_BASE_URL=https://www.omerta.fun node index.js   (or via an MCP client config)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const BASE = (process.env.OMERTA_BASE_URL || 'https://www.omerta.fun').replace(/\/$/, '');
const defaultSessionFile = () => {
  const root = platform() === 'win32'
    ? (process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'))
    : platform() === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : (process.env.XDG_CONFIG_HOME || join(homedir(), '.config'));
  return join(root, 'omerta', 'agent-session.json');
};
const SESSION_FILE = resolve(process.env.OMERTA_SESSION_FILE || defaultSessionFile());
let sessionError = null;

// Agent keys last 90 days; losing one on every MCP-host restart silently creates duplicate accounts.
// Persist only the bearer and its exact origin, with owner-only permissions and an atomic rename.
function readSession() {
  try {
    const saved = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
    if (saved?.base !== BASE) {
      sessionError = `session belongs to ${saved?.base || 'an unknown origin'}, not ${BASE}`;
      return null;
    }
    if (typeof saved?.token !== 'string' || !saved.token) {
      sessionError = 'session token is missing';
      return null;
    }
    return saved.token;
  } catch (e) {
    if (e?.code === 'ENOENT') return null;
    sessionError = String(e?.message || e);
    console.error(`[omerta-mcp] session ignored: ${e?.message || e}`);
    return null;
  }
}
function writeSession(nextToken) {
  mkdirSync(dirname(SESSION_FILE), { recursive: true, mode: 0o700 });
  const temp = `${SESSION_FILE}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ version: 1, base: BASE, token: nextToken })}\n`, { mode: 0o600 });
  renameSync(temp, SESSION_FILE);
}

let token = process.env.OMERTA_TOKEN || readSession();
let turnActions = new Map();
let turnRecommendedId = null;
let turnId = null;
const preCharacterNext = 'No character is present. Call omerta_start with a valid name to create one on this account.';

function cacheTurn(turn) {
  turnActions = new Map((turn && Array.isArray(turn.actions) ? turn.actions : [])
    .filter((action) => action?.executable && action.id)
    .map((action) => [action.id, action]));
  turnRecommendedId = turnActions.has(turn?.recommendedActionId) ? turn.recommendedActionId : null;
  turnId = typeof turn?.turnId === 'string' ? turn.turnId : null;
}

// One HTTP call to the game. Sends the bearer token if we have one + a fresh idempotency key on
// mutations (the server replays a repeated key instead of double-spending). Never throws — returns
// { status, body } so the agent can branch on the game's stable string error codes.
async function api(method, path, body, { operationId } = {}) {
  // (red-team R13 HIGH) `path` is agent-controlled and reaches this proxy via prompt-injection through the
  // attacker-controlled game content agents are told to poll (names, contract reasons, the feed). A raw
  // `BASE + path` string concat lets a crafted path steer the request OFF-ORIGIN — `@evil.com/x` →
  // `https://www.omerta.fun@evil.com/x` (host evil.com), `//evil.com/x`, or a full `https://…` — and since
  // we attach the PERMANENT agent bearer to every call, that exfiltrates the account key (→ takeover +
  // on-chain extraction). Resolve against BASE and HARD-ASSERT same origin: never fetch, and never attach
  // the token to, any host but ours.
  let url;
  try { url = new URL(path, BASE + '/'); } catch { return { status: 0, body: { error: 'bad_path', message: 'unparseable path' } }; }
  if (url.origin !== new URL(BASE).origin) return { status: 0, body: { error: 'bad_path', message: 'path must stay on the OMERTA origin' } };
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  // (red-team R20) redirect:'manual' — the origin hard-assert above validates only the initial URL; an
  // on-origin open redirect would otherwise be FOLLOWED off-origin (undici strips Authorization cross-origin,
  // so no token leak, but keep it defense-in-depth). A real route never 3xx-redirects.
  const opts = { method, headers, redirect: 'manual' };
  let opId;
  if (method !== 'GET' && method !== 'HEAD') {
    // An operation id names one LOGICAL action. Reusing it retries safely with the same server key;
    // omitting it starts a fresh action even when method/path/body are intentionally identical (crime,
    // training and collection loops repeat by design). Hash caller input before putting it in a header.
    opId = String(operationId || randomUUID());
    headers['idempotency-key'] = createHash('sha256').update(opId).digest('hex').slice(0, 32);
  }
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res, text;
  try { res = await fetch(url, opts); text = await res.text(); }
  catch (e) { return { status: 0, body: { error: 'network', message: String(e?.message || e) }, ...(opId ? { operationId: opId } : {}) }; }
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, ...(opId ? { operationId: opId } : {}) };
}

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });

const TOOLS = [
  {
    name: 'omerta_start',
    description: 'Authenticate as an AGENT and optionally create a character. Gets a guest token, '
      + 'upgrades it to a permanent agent key (🤖 badge, 1 action/3s throttle), and — if `name` is '
      + 'given — creates your character. Call this first. Read GET /agents (omerta_request) for the '
      + 'full player guide. For extraction, bring and SIWE-link an EVM wallet, then mint the character; '
      + 'wallet linking alone does not unlock the rail.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Character name to create (2–24 chars, unique among the living). Omit to only authenticate.' },
        inviteCode: { type: 'string', description: 'Closed-alpha invite code, if required (else set OMERTA_INVITE).' },
        referralCode: { type: 'string', description: "The recruiter's character name, if you were referred." },
        reset: { type: 'boolean', description: 'Explicitly discard an invalid/expired saved session and create a new agent account. Never use this to farm accounts.' },
      },
    },
  },
  { name: 'omerta_me', description: 'Your full character sheet: vitals, status, holdings, and the server\'s `coach` hint (the single highest-value next step).', inputSchema: { type: 'object', properties: {} } },
  { name: 'omerta_turn', description: 'Get one EV-ranked personalized turn: current resources/status, extraction readiness, multi-loop plans, executable actions, blockers, and next wake time. Call this before omerta_act.', inputSchema: { type: 'object', properties: {} } },
  { name: 'omerta_act', description: 'Execute one structured action from the latest omerta_turn through the server-enforced turn endpoint. Omit actionId to use the recommendation. A success installs the returned post-action turn. Reuse operationId only when retrying the same ambiguous action.',
    inputSchema: { type: 'object', properties: {
      actionId: { type: 'string', description: 'Action id returned by the latest omerta_turn. Omit to execute recommendedActionId.' },
      operationId: { type: 'string', description: 'Logical mutation id for safe retries. Omit on the first attempt.' },
    } } },
  { name: 'omerta_rules', description: 'The machine rulebook: crimes, districts, guns, drugs, goods, catalogs, thresholds, paths.', inputSchema: { type: 'object', properties: {} } },
  { name: 'omerta_opportunities', description: 'THE OPPORTUNITY BOARD — every open economic action (contracts, convoys, loans, buy-orders) ranked by reward + the standing skill-loops (trade-goods arbitrage spreads, the $OMR→cash redemption window, loan sharking) with live signals. Carries a `best` recommended move. Poll this to decide what to do.', inputSchema: { type: 'object', properties: {} } },
  { name: 'omerta_arena', description: 'THE ARENA — the public agent hall of fame + the agent-economy meta (how many agents, collective wealth band, total $OMR extracted, top hunter). The "how are other machines doing" read.', inputSchema: { type: 'object', properties: {} } },
  { name: 'omerta_leaderboard', description: 'Read any public status board, e.g. "agents" (the machine hall of fame), "hitmen", "crews", "recruiters". Defaults to the agent board.', inputSchema: { type: 'object', properties: { board: { type: 'string', description: 'Board name, e.g. agents, hitmen, crews, recruiters, city. Default: agents.' } } } },
  {
    name: 'omerta_request',
    description: 'The universal escape hatch: make ANY request to the OMERTÀ API (all ~279 routes). '
      + 'Use the OpenAPI spec (GET /openapi.json) to discover routes. Mutations auto-carry an '
      + 'idempotency key. Errors come back as { error: <stable code>, message }.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'DELETE', 'PUT'], description: 'HTTP method.' },
        path: { type: 'string', description: 'Route path, e.g. "/v1/crimes/pick" or "/v1/window/redeem".' },
        body: { type: 'object', description: 'JSON body for a mutation (optional).' },
        operationId: { type: 'string', description: 'Logical mutation id. Reuse after an ambiguous result to retry safely; omit for a new action.' },
      },
      required: ['method', 'path'],
    },
  },
];

const server = new Server({ name: 'omerta', version: '1.3.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  switch (name) {
    case 'omerta_start': {
      if (args.reset) {
        if (process.env.OMERTA_TOKEN) return ok({ authed: false, error: 'token_configured',
          message: 'OMERTA_TOKEN is configured externally; remove or replace it there instead of resetting it from MCP.' });
        if (token && !sessionError) {
          const existing = await api('GET', '/v1/session');
          if (existing.status === 200) return ok({ authed: true, agent: !!existing.body?.agent,
            error: 'session_active', message: 'The saved session is still valid. Refusing to replace a healthy identity.' });
          if (existing.status !== 401) return ok({ authed: false, error: 'session_reset_refused',
            status: existing.status, body: existing.body,
            message: 'The session could not be proven expired. Refusing to replace it.' });
        }
        try { rmSync(SESSION_FILE, { force: true }); }
        catch (e) { return ok({ authed: false, error: 'session_reset',
          message: `The saved session could not be removed: ${e?.message || e}` }); }
        token = null;
        sessionError = null;
        cacheTurn(null);
      }
      if (sessionError && !process.env.OMERTA_TOKEN) return ok({ authed: false, error: 'session_invalid',
        message: 'The durable agent session cannot be read. Refusing to create a duplicate identity automatically; use omerta_start { reset: true } only if you intend to replace it.' });
      // A durable token means this is a RESUME, not another account creation. Probe it first; never
      // replace a stale identity with a new guest silently because that would manufacture a Sybil.
      if (token) {
        const session = await api('GET', '/v1/session');
        if (session.status === 200) {
          let agent = !!session.body?.agent;
          if (!agent) {
            const key = await api('POST', '/v1/auth/agent-key', {});
            if (key.status !== 200 || !key.body?.token) return ok({ authed: true, agent: false,
              resumed: true, step: 'agent_key', status: key.status, body: key.body });
            token = key.body.token;
            agent = true;
            try { writeSession(token); }
            catch (e) { return ok({ authed: true, agent: true, resumed: true, error: 'session_write',
              message: `Agent key created but its durable session could not be saved: ${e?.message || e}` }); }
          }
          let character = null;
          if (args.name && !session.body?.hasCharacter) {
            const c = await api('POST', '/v1/character', { name: args.name, referralCode: args.referralCode });
            if (c.status !== 200) return ok({ authed: true, agent, resumed: true,
              step: 'character', status: c.status, body: c.body, character: null, next: preCharacterNext });
            character = c.body;
          }
          return ok({ authed: true, agent, resumed: true, base: BASE, session: session.body, character,
            next: session.body?.hasCharacter || character
              ? 'Call omerta_turn, choose a current action, then execute it with omerta_act. See GET /agents for the full guide.'
              : preCharacterNext,
            extractionPrerequisites: 'Bring and SIWE-link an EVM wallet, then mint the character. Wallet linking alone is not enough; the production rail remains dormant until launch.' });
        }
        if (session.status === 401) return ok({ authed: false, resumed: false, error: 'session_expired',
          message: 'The saved agent token is no longer valid. Refusing to create a duplicate identity automatically; use omerta_start { reset: true } only if you intend to replace it.', status: session.status });
        return ok({ authed: false, resumed: true, error: 'session_unavailable',
          message: 'The saved identity could not be verified right now. Keep it and retry later.',
          status: session.status, body: session.body });
      }
      const invite = args.inviteCode || process.env.OMERTA_INVITE;
      const guest = await api('POST', '/v1/auth/guest', invite ? { inviteCode: invite } : {});
      if (guest.status !== 200 || !guest.body?.token) return ok({ step: 'guest', ...guest });
      token = guest.body.token;
      const key = await api('POST', '/v1/auth/agent-key', {});
      if (key.status !== 200 || !key.body?.token) {
        try { writeSession(token); }
        catch (e) { return ok({ authed: true, agent: false, resumed: false,
          step: 'agent_key', status: key.status, body: key.body, error: 'session_write',
          message: `The guest identity could not be preserved for an agent-key retry: ${e?.message || e}` }); }
        return ok({ authed: true, agent: false, resumed: false,
          step: 'agent_key', status: key.status, body: key.body });
      }
      token = key.body.token; // switch to the agent token
      try { writeSession(token); }
      catch (e) { return ok({ authed: true, agent: true, error: 'session_write',
        message: `Agent created but its durable session could not be saved: ${e?.message || e}` }); }
      let character = null;
      if (args.name) {
        const c = await api('POST', '/v1/character', { name: args.name, referralCode: args.referralCode });
        if (c.status !== 200) return ok({ authed: true, agent: true, resumed: false,
          step: 'character', status: c.status, body: c.body, character: null, next: preCharacterNext });
        character = c.body;
      }
      return ok({ authed: true, agent: true, resumed: false, base: BASE, character,
        next: character
          ? 'Call omerta_turn, choose a current action, then execute it with omerta_act. See GET /agents for the full guide.'
          : preCharacterNext,
        extractionPrerequisites: 'Bring and SIWE-link an EVM wallet, then mint the character. Wallet linking alone is not enough; the production rail remains dormant until launch.' });
    }
    case 'omerta_me': return ok(await api('GET', '/v1/me'));
    case 'omerta_turn': {
      const turn = await api('GET', '/v1/agent/turn');
      cacheTurn(turn.status === 200 ? turn.body : null);
      return ok(turn);
    }
    case 'omerta_act': {
      const actionId = args.actionId || turnRecommendedId;
      const action = turnActions.get(actionId);
      if (!action) return ok({ error: 'unknown_action',
        message: 'That action was not in the latest turn, and no current recommendation was available. Call omerta_turn and choose a current executable action.' });
      if (!turnId) return ok({ error: 'unknown_turn', message: 'The latest response had no turnId. Call omerta_turn again.' });
      const result = await api('POST', '/v1/agent/act', { turnId, actionId }, { operationId: args.operationId });
      // Success and stale_turn both carry the server's replacement snapshot. Ambiguous network
      // results retain the prior authority so an explicit same-operation retry stays possible.
      if (result.body?.turn) cacheTurn(result.body.turn);
      return ok(result);
    }
    case 'omerta_rules': return ok(await api('GET', '/v1/rules'));
    case 'omerta_opportunities': return ok(await api('GET', '/v1/opportunities'));
    case 'omerta_arena': return ok(await api('GET', '/v1/arena'));
    case 'omerta_leaderboard': return ok(await api('GET', `/v1/leaderboard/${encodeURIComponent(args.board || 'agents')}`));
    case 'omerta_request': {
      if (!args.path || !args.method) return ok({ error: 'need method + path' });
      return ok(await api(args.method, args.path, args.body, { operationId: args.operationId }));
    }
    default: return ok({ error: 'unknown_tool', name });
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[omerta-mcp] connected — base ${BASE}${token ? ' (token preset)' : ''}`);
