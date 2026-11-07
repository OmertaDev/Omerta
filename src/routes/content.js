// Authored graph content — operator activation plus authenticated player boards and mutations.
// Account, character, organization, participant kind, and effect authority are always derived by
// the runtime; handlers copy only the caller choices defined by the public contract.
import * as G from '../game.js';
import {
  activateContentBundle,
  contentBoard,
  createContentInstance,
  contentInstanceBoard,
  joinContentInstance,
  setContentConsent,
  actOnContentInstance,
  leaveContentInstance,
  claimContentRewards,
  addContentCaseNote,
  releaseContentRole,
} from '../content/runtime.js';
import {
  craftingBoard,
  collectContentSource,
  startContentWorkOrder,
  finishContentWorkOrder,
  craftContentRecipe,
  repairContentTool,
} from '../content/crafting.js';
import {
  attachContentExchanges,
  createContentExchangeListing,
  cancelContentExchangeListing,
  fillContentExchangeListing,
} from '../content/exchange.js';

const createBody = {
  type: 'object', additionalProperties: false, required: ['scopeKind', 'roleId'],
  properties: {
    scopeKind: { type: 'string', enum: ['personal', 'crew', 'extended_family', 'invitation'] },
    roleId: { type: 'string', minLength: 1 }, consent: { type: 'boolean' },
    agendaConsent: { type: 'boolean' },
    invitedAccountIds: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 160 } },
  },
};
const joinBody = {
  type: 'object', additionalProperties: false, required: ['expectedRevision', 'roleId'],
  properties: {
    expectedRevision: { type: 'integer', minimum: 0 }, roleId: { type: 'string', minLength: 1 },
    consent: { type: 'boolean' },
    agendaConsent: { type: 'boolean' },
  },
};
const consentBody = {
  type: 'object', additionalProperties: false, required: ['expectedRevision', 'on'],
  properties: { expectedRevision: { type: 'integer', minimum: 0 }, on: { type: 'boolean' } },
};
const actBody = {
  type: 'object', additionalProperties: false, required: ['expectedRevision', 'actionId'],
  not: { required: ['answer', 'choiceId'] },
  properties: {
    expectedRevision: { type: 'integer', minimum: 0 }, actionId: { type: 'string', minLength: 1 },
    answer: { type: 'string' }, choiceId: { type: 'string', minLength: 1 },
    submission: {
      type: 'object', additionalProperties: false,
      properties: {
        ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },
        assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },
      },
      oneOf: [{ required: ['ids'] }, { required: ['assignments'] }],
    },
    hint: { type: 'boolean' },
  },
};
const revisionBody = {
  type: 'object', additionalProperties: false, required: ['expectedRevision'],
  properties: { expectedRevision: { type: 'integer', minimum: 0 } },
};
const noteBody = {
  type: 'object', additionalProperties: false, required: ['expectedRevision', 'text'],
  properties: {
    expectedRevision: { type: 'integer', minimum: 0 },
    text: { type: 'string', minLength: 1, maxLength: 500 },
  },
};
const activationBody = {
  type: 'object', additionalProperties: false, required: ['bundle', 'expectedHash'],
  properties: {
    bundle: { type: 'object' }, expectedHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  },
};
const contentHashBody = {
  type: 'object', additionalProperties: false, required: ['expectedContentHash'],
  properties: { expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' } },
};
const exchangeListingBody = {
  type: 'object', additionalProperties: false,
  required: [
    'expectedContentHash', 'offeredItemId', 'offeredQuantity',
    'requestedItemId', 'requestedQuantity',
  ],
  properties: {
    expectedContentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    offeredItemId: { type: 'string', minLength: 1 },
    offeredQuantity: { type: 'integer', minimum: 1, maximum: 10000 },
    requestedItemId: { type: 'string', minLength: 1 },
    requestedQuantity: { type: 'integer', minimum: 1, maximum: 10000 },
  },
};
const invalidBody = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'bad_request';
  throw error;
};
const strictValue = (rule, value, key) => {
  if (rule.type === 'integer' && !Number.isInteger(value)) invalidBody(`${key} must be an integer.`);
  if (rule.type === 'string' && typeof value !== 'string') invalidBody(`${key} must be a string.`);
  if (rule.type === 'boolean' && typeof value !== 'boolean') invalidBody(`${key} must be a boolean.`);
  if (rule.type === 'array') {
    if (!Array.isArray(value)) invalidBody(`${key} must be an array.`);
    if (rule.items) value.forEach((item, index) => strictValue(rule.items, item, `${key}[${index}]`));
  }
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalidBody(`${key} must be an object.`);
    for (const [name, item] of Object.entries(value)) {
      const child = Object.hasOwn(rule.properties || {}, name) ? rule.properties[name]
        : typeof rule.additionalProperties === 'object' ? rule.additionalProperties : null;
      if (child) strictValue(child, item, `${key}.${name}`);
    }
  }
};
const strictBody = (shape) => async (req) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalidBody('Request body must be a JSON object.');
  }
  const allowed = new Set(Object.keys(shape.properties));
  const unexpected = Object.keys(body).find((key) => !allowed.has(key));
  if (unexpected) invalidBody(`Unexpected request field: ${unexpected}.`);
  for (const key of shape.required || []) {
    if (!Object.hasOwn(body, key)) invalidBody(`Missing required request field: ${key}.`);
  }
  for (const [key, rule] of Object.entries(shape.properties)) {
    if (!Object.hasOwn(body, key)) continue;
    strictValue(rule, body[key], key);
  }
  if (shape.not?.required?.every((key) => Object.hasOwn(body, key))) {
    invalidBody(`${shape.not.required.join(' and ')} cannot be supplied together.`);
  }
};
const guarded = (preHandler, body) => ({
  preHandler, preValidation: strictBody(body), schema: { body },
});

async function instanceMutation(reply, run) {
  try {
    return await run();
  } catch (error) {
    if (!['stale_instance', 'stale_content'].includes(error?.code)) throw error;
    return reply.code(409).send({
      error: error.code,
      message: error.message,
      ...(error.data || {}),
    });
  }
}

export function register(app, { pool, auth, modAuth }) {
  app.get('/v1/content', { preHandler: auth }, async (req) =>
    G.readCharacter(pool, req.user.sub, async (ch, client, h) => {
      const crafting = await craftingBoard(ch, client, h);
      return {
        ...await contentBoard(ch, client, h),
        crafting: await attachContentExchanges(ch, client, h, crafting),
      };
    }));

  app.post('/v1/content/:namespace/exchange/list', guarded(auth, exchangeListingBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => createContentExchangeListing(
        ch, req.params.namespace, {
          expectedContentHash: req.body?.expectedContentHash,
          offeredItemId: req.body?.offeredItemId,
          offeredQuantity: req.body?.offeredQuantity,
          requestedItemId: req.body?.requestedItemId,
          requestedQuantity: req.body?.requestedQuantity,
        }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/exchange/:listingId/cancel', guarded(auth, contentHashBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => cancelContentExchangeListing(
        ch, req.params.namespace, req.params.listingId,
        { expectedContentHash: req.body?.expectedContentHash }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/exchange/:listingId/fill', guarded(auth, contentHashBody),
    async (req, reply) => {
      const listing = (await pool.query(
        `SELECT c.id AS seller_character
           FROM content_exchange_listings l
           JOIN characters c ON c.account_id=l.seller_account AND c.alive
          WHERE l.id=$1 AND l.namespace=$2 AND l.status='live'`,
        [req.params.listingId, req.params.namespace],
      )).rows[0];
      if (!listing) throw new G.GameError('gone', 'That authored exchange offer is no longer open.');
      return instanceMutation(reply, () => G.withTwoCharacters(
        pool, req.user.sub, listing.seller_character,
        (ch, seller, client, h) => fillContentExchangeListing(
          ch, seller, req.params.namespace, req.params.listingId,
          { expectedContentHash: req.body?.expectedContentHash }, client, h,
        ),
        // The named public listing authorizes a trade without exposing a remote sighting.
        { meet: false, requireKnown: false },
      ));
    });

  app.post('/v1/content/:namespace/sources/:sourceId/collect', guarded(auth, contentHashBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => collectContentSource(
        ch, req.params.namespace, req.params.sourceId,
        { expectedContentHash: req.body?.expectedContentHash }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/jobs/:jobId/start', guarded(auth, contentHashBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => startContentWorkOrder(
        ch, req.params.namespace, req.params.jobId,
        { expectedContentHash: req.body?.expectedContentHash }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/jobs/:jobId/collect', guarded(auth, contentHashBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => finishContentWorkOrder(
        ch, req.params.namespace, req.params.jobId,
        { expectedContentHash: req.body?.expectedContentHash }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/recipes/:recipeId/craft', guarded(auth, contentHashBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => craftContentRecipe(
        ch, req.params.namespace, req.params.recipeId,
        { expectedContentHash: req.body?.expectedContentHash }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/tools/:toolId/repair', guarded(auth, contentHashBody),
    async (req, reply) => instanceMutation(reply, () => G.withCharacter(
      pool, req.user.sub, (ch, client, h) => repairContentTool(
        ch, req.params.namespace, req.params.toolId,
        { expectedContentHash: req.body?.expectedContentHash }, client, h,
      ),
    )));

  app.post('/v1/content/:namespace/instances', guarded(auth, createBody), async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => createContentInstance(
      ch,
      req.params.namespace,
      { scopeKind: req.body?.scopeKind, roleId: req.body?.roleId, consent: req.body?.consent,
        agendaConsent: req.body?.agendaConsent, invitedAccountIds: req.body?.invitedAccountIds },
      client,
      h,
    )));

  app.get('/v1/content/instances/:instanceId', { preHandler: auth }, async (req) =>
    G.readCharacter(pool, req.user.sub, (ch, client, h) =>
      contentInstanceBoard(ch, req.params.instanceId, client, h)));

  app.post('/v1/content/instances/:instanceId/join', guarded(auth, joinBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      joinContentInstance(ch, req.params.instanceId, {
        expectedRevision: req.body?.expectedRevision,
        roleId: req.body?.roleId,
        consent: req.body?.consent,
        agendaConsent: req.body?.agendaConsent,
      }, client, h))));

  app.post('/v1/content/instances/:instanceId/consent', guarded(auth, consentBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      setContentConsent(ch, req.params.instanceId, {
        expectedRevision: req.body?.expectedRevision,
        consent: req.body?.on,
      }, client, h))));

  app.post('/v1/content/instances/:instanceId/act', guarded(auth, actBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      actOnContentInstance(ch, req.params.instanceId, {
        expectedRevision: req.body?.expectedRevision,
        actionId: req.body?.actionId,
        answer: req.body?.answer,
        choiceId: req.body?.choiceId,
        submission: req.body?.submission,
        hint: req.body?.hint,
      }, client, h))));

  app.post('/v1/content/instances/:instanceId/leave', guarded(auth, revisionBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      leaveContentInstance(ch, req.params.instanceId, {
        expectedRevision: req.body?.expectedRevision,
      }, client, h))));

  app.post('/v1/content/instances/:instanceId/notes', guarded(auth, noteBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      addContentCaseNote(ch, req.params.instanceId, {
        expectedRevision: req.body?.expectedRevision, text: req.body?.text,
      }, client, h))));

  app.post('/v1/content/instances/:instanceId/release', guarded(auth, revisionBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      releaseContentRole(ch, req.params.instanceId, { expectedRevision: req.body?.expectedRevision }, client, h))));

  app.post('/v1/content/instances/:instanceId/claim', guarded(auth, revisionBody), async (req, reply) =>
    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      claimContentRewards(ch, req.params.instanceId, {
        expectedRevision: req.body?.expectedRevision,
      }, client, h))));

  app.post('/v1/mod/content/activate', guarded(modAuth, activationBody), async (req) =>
    activateContentBundle(pool, {
      bundle: req.body?.bundle,
      expectedHash: req.body?.expectedHash,
      operatorId: 'mod',
    }));
}
