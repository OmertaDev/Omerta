// Provider-neutral HTTP boundary. The player and delegated-agent credentials are separate.
import { readFileSync } from 'node:fs';
import { createGatewaySecurity, SCOPES, DEFAULT_SCOPES, GatewayError, fail, validate, object, identifier } from '../gateway/security.js';
import { CAPABILITIES } from '../gateway/capabilities.js';
import { createContextGateway } from '../gateway/context.js';
import { createAgentGateway } from '../gateway/service.js';
import { createEventGateway } from '../gateway/events.js';
import { createMuseAdapter } from '../integrations/muse/index.js';
import { checkAuthRateLimit, rateLimitsEnabled } from '../ratelimit.js';
import { bus } from '../game.js';
import { innerIdempotencyKey } from './worldgraph.js';

const callInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 3 || !Object.hasOwn(body, 'capability')
      || !Object.hasOwn(body, 'arguments') || !Object.hasOwn(body, 'requestId')) fail('invalid_arguments');
};
function eventQuery(query, { stream = false } = {}) {
  if (Object.keys(query).some((key) => !['subscriptionId', 'after', ...(stream ? [] : ['limit'])].includes(key))) fail('invalid_arguments');
  validate(query.subscriptionId, identifier);
  if (query.after !== undefined) validate(query.after, { type: 'string', maxLength: 3000, pattern: '^[A-Za-z0-9_-]+$' });
  if (query.limit !== undefined && (typeof query.limit !== 'string' || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(query.limit))) fail('invalid_arguments');
  return { subscriptionId: query.subscriptionId, after: query.after, ...(stream ? {} : { limit: query.limit === undefined ? 50 : Number(query.limit) }) };
}
export function register(app, { pool, auth, coordination, context: contextOverride, dispatch: dispatchOverride }) {
  const security = createGatewaySecurity({ pool });
  const context = contextOverride || createContextGateway({ pool, coordination });
  const gateway = createAgentGateway({ pool, security, context, capabilities: CAPABILITIES,
    resolveReceipt: async ({ url, accountId, idempotencyKey }) => {
      if (url.startsWith('/v1/coordination/')) {
        const row = (await pool.query('SELECT command_id FROM coordination_commands WHERE account_id=$1 AND command_key=$2',
          [accountId, idempotencyKey])).rows[0];
        return row ? { statusCode: 200 } : null;
      }
      const row = (await pool.query('SELECT completed_at FROM item_mutation_guards WHERE idempotency_key=$1',
        [innerIdempotencyKey(accountId, idempotencyKey)])).rows[0];
      return row?.completed_at ? { statusCode: 200 } : null;
    },
    dispatch: dispatchOverride || (async ({ url, body, authorization, idempotencyKey }) => {
      const response = await app.inject({ method: 'POST', url, payload: body,
        headers: { authorization, 'idempotency-key': idempotencyKey } });
      let result; try { result = response.json(); } catch { /* Never expose raw upstream HTML. */ }
      return { statusCode: response.statusCode, ...(typeof result?.error === 'string' ? { error: result.error } : {}) };
    }),
  });
  const events = createEventGateway({ pool, bus, coordination, authorize: security.revalidate });
  const muse = createMuseAdapter({ gateway, capabilities: CAPABILITIES });
  const streams = new Set();
  app.addHook('preClose', async () => { for (const stream of streams) stream.close('server_shutdown'); });
  const respond = (handler) => async (req, reply) => {
    reply.header('cache-control', 'private, no-store').header('referrer-policy', 'no-referrer');
    try { return await handler(req, reply); }
    catch (error) {
      const status = Number(error.statusCode);
      // Return only stable codes, never SQL, game error data, private clue failures, or stack traces.
      const known = error instanceof GatewayError || (status >= 400 && status <= 499 && /^[a-z][a-z0-9_]{1,79}$/.test(error.code || ''));
      const code = known ? error.code : 'gateway_unavailable';
      if (status === 429) reply.header('retry-after', '60');
      return reply.code(known ? status : 503).send({ error: code });
    }
  };
  const gatewayAuth = respond(async (req, reply) => {
    if (rateLimitsEnabled()) {
      const limited = await checkAuthRateLimit({ ip: 'gateway:' + req.clientIp });
      if (limited) return reply.code(429).header('retry-after', limited.retryAfter).send({ error: 'rate_limited' });
    }
    req.gatewayPrincipal = await security.authenticate(req.headers.authorization,
      req.routeOptions.url.startsWith('/integrations/muse/') ? 'muse' : undefined);
    if (!req.routeOptions.url.endsWith('/call')) await security.rateLimit(req.gatewayPrincipal);
  });
  // onRoute's discovery sees the actual named authentication hook; the wrapper itself is not authority.
  Object.defineProperty(gatewayAuth, 'name', { value: 'gatewayAuth' });
  const playerOnly = respond(async (req) => {
    if (req.user?.agent === true) fail('player_confirmation_required', 403);
    if (req.headers.origin) {
      let host;
      try { host = new URL(req.headers.origin).host; } catch { fail('invalid_origin', 403); }
      if (host !== req.headers.host) fail('invalid_origin', 403);
    }
  });
  const player = { preHandler: [auth, playerOnly], bodyLimit: 16384 };
  const delegated = { preHandler: gatewayAuth, bodyLimit: 16384 };
  const observed = (name, handler) => respond((req, reply) =>
    gateway.observe(req.gatewayPrincipal, name, () => handler(req, reply)));
  const noQuery = async (req) => { if (Object.keys(req.query || {}).length) fail('invalid_arguments'); };

  app.get('/v1/gateway/scopes', player, respond(async () => ({ scopes: SCOPES, defaultScopes: DEFAULT_SCOPES })));
  app.get('/v1/gateway/connections', player, respond((req) => security.list(req.user.sub)));
  app.post('/v1/gateway/connections', { ...player, preValidation: respond(async (req) => {
    // The legacy HTTP idempotency store saves full responses. One-time credentials must never
    // enter it; reject before the global preHandler can create that reservation.
    if (req.headers['idempotency-key'] !== undefined) fail('credential_not_replayable');
  }) }, respond((req) => security.create(req.user.sub, req.body)));
  app.delete('/v1/gateway/connections/:id', player, respond((req) => security.revoke(req.user.sub, req.params.id)));
  app.get('/v1/gateway/activity', player, respond((req) => gateway.activity(req.user.sub)));
  app.get('/v1/gateway/preparations/:id', player, respond((req) => gateway.preparation(req.user.sub, req.params.id)));
  app.post('/v1/gateway/preparations/:id/confirm', player, respond((req) => gateway.confirm(req.user.sub, req.params.id, req.body, req.headers.authorization)));
  app.get('/v1/gateway/capabilities', delegated, observed('gateway.capabilities', async (req) => {
    await noQuery(req);
    return { schemaVersion: 1, capabilities: gateway.capabilities(req.gatewayPrincipal) };
  }));
  app.post('/v1/gateway/call', delegated, respond(async (req) => {
    callInput(req.body);
    return gateway.execute(req.gatewayPrincipal, req.body.capability, req.body.arguments, { requestId: req.body.requestId });
  }));
  app.get('/v1/gateway/events/catalog', delegated, observed('events.catalog', (req) => events.catalog(req.gatewayPrincipal)));
  app.get('/v1/gateway/subscriptions', delegated, observed('events.subscriptions', (req) => events.subscriptions(req.gatewayPrincipal)));
  app.post('/v1/gateway/subscriptions', delegated, observed('events.subscribe', (req) => {
    validate(req.body, object({ topics: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true,
      items: { type: 'string', maxLength: 80 } } }, ['topics']));
    return events.subscribe(req.gatewayPrincipal, req.body);
  }));
  app.delete('/v1/gateway/subscriptions/:id', delegated, observed('events.unsubscribe', (req) => events.unsubscribe(req.gatewayPrincipal, req.params.id)));
  app.get('/v1/gateway/events', delegated, observed('events.read', (req) => events.read(req.gatewayPrincipal, eventQuery(req.query))));
  app.get('/v1/gateway/events/stream', { ...delegated, exposeHeadRoute: false }, respond(async (req, reply) => {
    const input = eventQuery(req.query, { stream: true });
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId !== undefined) {
      validate(lastEventId, { type: 'string', maxLength: 3000, pattern: '^[A-Za-z0-9_-]+$' });
      if (input.after && input.after !== lastEventId) fail('invalid_event_cursor');
      input.after = lastEventId;
    }
    // Validate ownership/cursor before entering a long-lived response.
    await gateway.observe(req.gatewayPrincipal, 'events.stream', () => events.read(req.gatewayPrincipal, { ...input, limit: 1 }));
    reply.hijack();
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'private, no-store',
      'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
    let stream;
    try {
      stream = await events.stream(req.gatewayPrincipal, { ...input,
        onEvent: (event) => reply.raw.write(`id: ${event.cursor}\nevent: ${event.topic}\ndata: ${JSON.stringify(event)}\n\n`),
        onHeartbeat: ({ cursor }) => {
          if (!reply.raw.destroyed && !reply.raw.write(`event: cursor\ndata: ${JSON.stringify({ cursor })}\n\n`)) {
            stream?.close('backpressure');
            reply.raw.end();
          }
        },
        onClose: () => { if (stream) streams.delete(stream); reply.raw.end(); },
      });
      if (!stream.closed) streams.add(stream);
      reply.raw.on('close', () => { stream.close(); streams.delete(stream); });
      if (reply.raw.destroyed) stream.close();
    } catch { reply.raw.end(); }
  }));
  app.get('/integrations/muse', respond(async () => muse.manifest()));
  app.get('/integrations/muse/tools', delegated, observed('muse.tools', async (req) => ({ tools: muse.listTools(req.gatewayPrincipal.scopes) })));
  app.post('/integrations/muse/call', delegated, respond((req) => muse.callTool(req.gatewayPrincipal, req.body)));
  for (const [url, file, type] of [
    ['/consigliere', 'consigliere.html', 'text/html; charset=utf-8'],
    ['/consigliere.js', 'consigliere.js', 'application/javascript; charset=utf-8'],
  ]) {
    const content = readFileSync(new URL('../../public/' + file, import.meta.url), 'utf8');
    app.get(url, respond(async (_req, reply) => reply.header('x-frame-options', 'DENY').type(type).send(content)));
  }
  return { gateway, security, events, muse };
}
