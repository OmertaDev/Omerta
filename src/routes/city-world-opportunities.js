import { GameError } from '../game.js';
import { createCityWorldOpportunities } from '../city-world-opportunities.js';
import { validateCityOpportunityBody, CITY_WORLD_OPPORTUNITY_REQUEST_SCHEMAS,
  CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA, CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA,
  CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA } from '../city-world-opportunities-contract.js';

const emptyQuery = { type: 'object', additionalProperties: false, properties: {} };
const params = (node = false) => ({ type: 'object', additionalProperties: false,
  required: ['npcId', 'graphRef', ...(node ? ['nodeId'] : [])], properties: {
    npcId: { type: 'string', minLength: 1, maxLength: 200 }, graphRef: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    ...(node ? { nodeId: { type: 'string', minLength: 1, maxLength: 200 } } : {}),
  } });

export function register(app, { pool, auth, registry = null, now } = {}) {
  const opportunities = createCityWorldOpportunities({ pool, registry, ...(now ? { now } : {}) });
  const privateResponse = async (_req, reply) => {
    reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Authorization');
  };
  const execute = action => async (req, reply) => {
    try { return await action(req); } catch (error) {
      if (!(error instanceof GameError)) throw error;
      const status = ['city_opportunity_identity_changed', 'city_npc_unavailable', 'city_npc_binding_changed'].includes(error.code) ? 409
        : error.code === 'mystery_owner_forbidden' ? 403
          : ['city_opportunity_unavailable', 'no_character'].includes(error.code) ? 404 : 400;
      return reply.code(status).send({ error: error.code, message: error.message });
    }
  };
  const rejectQuery = async req => {
    if (Object.keys(req.query || {}).length) { const error = new GameError('bad_city_opportunity', 'Use a current issued opportunity URL.'); error.statusCode = 400; throw error; }
  };
  app.get('/v1/city/opportunities', { onRequest: privateResponse, preHandler: auth, preValidation: rejectQuery,
    schema: { querystring: emptyQuery, response: { 200: CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA } } },
  execute(req => opportunities.index(req.user.sub)));
  const base = '/v1/city/opportunities/:npcId/:graphRef';
  app.get(base, { onRequest: privateResponse, preHandler: auth, preValidation: rejectQuery,
    schema: { querystring: emptyQuery, params: params(), response: { 200: CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA } } },
  execute(req => opportunities.detail(req.user.sub, req.params.npcId, req.params.graphRef)));
  for (const [kind, path, node] of [
    ['start', base + '/start', false], ['explore', base + '/explore', false], ['cancel', base + '/cancel', false],
    ['complete', base + '/nodes/:nodeId/complete', true], ['choice', base + '/choices/:nodeId', true],
  ]) app.post(path, { onRequest: privateResponse, preHandler: auth, preValidation: async req => {
    await rejectQuery(req);
    try { validateCityOpportunityBody(kind, req.body); } catch (error) { error.statusCode = 400; throw error; }
  }, schema: { querystring: emptyQuery, params: params(node), body: CITY_WORLD_OPPORTUNITY_REQUEST_SCHEMAS[kind],
    response: { 200: CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA } } }, execute(req => opportunities.act(req.user.sub,
    req.params.npcId, req.params.graphRef, kind, req.body, req.headers['idempotency-key'], req.params.nodeId || null)));
}
