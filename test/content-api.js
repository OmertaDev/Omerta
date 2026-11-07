// AUTHORED CONTENT API — strict machine contract for the live graph runtime.
//
// Break caught: a content route can be mounted yet remain effectively undocumented when the OpenAPI
// registry falls back to its generic object request/response. That is especially dangerous here:
// clients must never invent actor/scope/effect authority, and the operator activation endpoint must
// never be advertised through the public player contract.
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { buildOpenApi } from '../src/agentgateway.js';
import { register as registerContentRoutes } from '../src/routes/content.js';
import { validateNarrativeAnswer } from '../src/content/narrative.js';
import { register as registerQuestingRoutes } from '../src/routes/questing.js';
import { register as registerWorkshopRoutes } from '../src/routes/quest-workshop.js';
import { QUESTING_CONTRACTS } from '../src/questing-contract.js';

const routes = [
  { method: 'GET', url: '/v1/content', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/exchange/list', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/exchange/:listingId/cancel', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/exchange/:listingId/fill', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/sources/:sourceId/collect', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/jobs/:jobId/start', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/jobs/:jobId/collect', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/recipes/:recipeId/craft', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/tools/:toolId/repair', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/:namespace/instances', hasAuth: true, isMod: false },
  { method: 'GET', url: '/v1/content/instances/:instanceId', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/join', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/consent', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/act', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/leave', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/notes', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/release', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/content/instances/:instanceId/claim', hasAuth: true, isMod: false },
  { method: 'POST', url: '/v1/mod/content/activate', hasAuth: true, isMod: true },
];

const spec = buildOpenApi(routes, { baseUrl: 'https://example.test', version: '1.1.0-test' });
const playerPaths = [
  '/v1/content',
  '/v1/content/{namespace}/sources/{sourceId}/collect',
  '/v1/content/{namespace}/jobs/{jobId}/start',
  '/v1/content/{namespace}/jobs/{jobId}/collect',
  '/v1/content/{namespace}/recipes/{recipeId}/craft',
  '/v1/content/{namespace}/tools/{toolId}/repair',
  '/v1/content/{namespace}/exchange/list',
  '/v1/content/{namespace}/exchange/{listingId}/cancel',
  '/v1/content/{namespace}/exchange/{listingId}/fill',
  '/v1/content/{namespace}/instances',
  '/v1/content/instances/{instanceId}',
  '/v1/content/instances/{instanceId}/join',
  '/v1/content/instances/{instanceId}/consent',
  '/v1/content/instances/{instanceId}/act',
  '/v1/content/instances/{instanceId}/leave',
  '/v1/content/instances/{instanceId}/notes',
  '/v1/content/instances/{instanceId}/release',
  '/v1/content/instances/{instanceId}/claim',
];

for (const path of playerPaths) {
  assert(spec.paths[path], `${path} is published in the machine contract`);
  const operation = spec.paths[path].get || spec.paths[path].post;
  assert.deepEqual(operation.security, [{ bearerAuth: [] }], `${path} requires bearer authority`);
  assert(operation.operationId, `${path} has a stable operationId`);
  assert(operation.responses[200]?.content?.['application/json']?.schema,
    `${path} publishes a typed success response`);
}
assert.equal(spec.paths['/v1/mod/content/activate'], undefined,
  'operator bundle activation remains outside the public player contract');

const tag = spec.tags.find((entry) => entry.name === 'content');
assert.match(tag?.description || '', /authored|mystery|content/i,
  'the content tag explains the authored runtime');

const strictBody = (path) => spec.paths[path].post.requestBody.content['application/json'].schema;
assert.deepEqual(strictBody('/v1/content/{namespace}/instances').required,
  ['scopeKind', 'roleId'], 'the active namespace derives the experience; creation accepts only caller choices');
assert.deepEqual(strictBody('/v1/content/{namespace}/instances').properties.scopeKind.enum,
  ['personal', 'crew', 'extended_family', 'invitation'],
  'creation exposes personal storylets alongside the existing organization scopes');
assert.equal(strictBody('/v1/content/{namespace}/instances').properties.consent.type, 'boolean',
  'creation can carry affirmative consent for a consent-required role');
assert.equal(strictBody('/v1/content/{namespace}/instances').properties.agendaConsent.type, 'boolean');
assert.equal(strictBody('/v1/content/{namespace}/instances').properties.invitedAccountIds.maxItems, 8);
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/join').required,
  ['expectedRevision', 'roleId'], 'joining requires a revision and self-claimed role');
assert.equal(strictBody('/v1/content/instances/{instanceId}/join').properties.consent.type, 'boolean',
  'joining can carry affirmative consent for a consent-required role');
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/consent').required,
  ['expectedRevision', 'on'], 'consent changes are revision-checked and self-owned');
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/act').required,
  ['expectedRevision', 'actionId'], 'actions require snapshot authority and a server-issued id');
assert.deepEqual(Object.keys(strictBody('/v1/content/instances/{instanceId}/act').properties),
  ['expectedRevision', 'actionId', 'answer', 'choiceId', 'submission', 'hint'],
  'action input maps the runtime answer/choice fields without a caller-controlled envelope');
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/act').not,
  { required: ['answer', 'choiceId'] }, 'an action request cannot mix puzzle and choice inputs');
assert.equal(strictBody('/v1/content/instances/{instanceId}/act').properties.submission.properties.ids.maxItems, 64,
  'the transport admits the same bounded item count as the narrative verifier');
assert.doesNotThrow(() => validateNarrativeAnswer({ payload: { verifier: 'ordered_ids', solution: ['a'.repeat(160)] } }, 'boundary'));
assert.throws(() => validateNarrativeAnswer({ payload: { verifier: 'ordered_ids', solution: ['a'.repeat(161)] } }, 'boundary'),
  'compiled interaction ids must fit the public transport bound');
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/leave').required,
  ['expectedRevision'], 'leaving is revision checked');
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/claim').required,
  ['expectedRevision'], 'reward claims are revision checked');
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/notes').required, ['expectedRevision', 'text']);
assert.equal(strictBody('/v1/content/instances/{instanceId}/notes').properties.text.maxLength, 500);
assert.deepEqual(strictBody('/v1/content/instances/{instanceId}/release').required, ['expectedRevision']);
assert.deepEqual(strictBody('/v1/content/{namespace}/exchange/list').required, [
  'expectedContentHash', 'offeredItemId', 'offeredQuantity', 'requestedItemId', 'requestedQuantity',
], 'an authored exchange listing accepts only the exact hash and player-selected compiled barter legs');
for (const path of [
  '/v1/content/{namespace}/exchange/{listingId}/cancel',
  '/v1/content/{namespace}/exchange/{listingId}/fill',
]) {
  assert.deepEqual(strictBody(path).required, ['expectedContentHash'],
    `${path} executes only the board-issued exact-hash offer`);
}

for (const path of [
  '/v1/content/instances/{instanceId}/join',
  '/v1/content/instances/{instanceId}/consent',
  '/v1/content/instances/{instanceId}/act',
  '/v1/content/instances/{instanceId}/leave',
  '/v1/content/instances/{instanceId}/notes',
  '/v1/content/instances/{instanceId}/release',
  '/v1/content/instances/{instanceId}/claim',
]) {
  assert.equal(spec.paths[path].post.responses[409]?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/ContentStaleResponse',
    `${path} publishes the replacement projection returned with stale_instance`);
}
assert.equal(spec.components.schemas.ContentStaleResponse.properties.instance.oneOf.some((entry) => (
  entry.$ref === '#/components/schemas/ContentInstanceSummary'
)), true, 'a stale join can return a safe closed-lobby tombstone');

for (const path of playerPaths.filter((path) => spec.paths[path].post)) {
  const body = strictBody(path);
  assert.equal(body.additionalProperties, false, `${path} rejects undeclared authority fields`);
  for (const forbidden of ['accountId', 'actorId', 'characterId', 'scopeId', 'effects']) {
    assert.equal(Object.hasOwn(body.properties || {}, forbidden), false,
      `${path} does not accept caller-supplied ${forbidden}`);
  }
}

for (const name of ['ContentBoard', 'ContentInstance', 'ContentInstanceSummary', 'ContentLobby',
  'ContentMember', 'ContentRole', 'ContentOpenRole', 'ContentLocation', 'ContentGateState',
  'ContentStoryFlag', 'ContentNode', 'ContentAction', 'ContentAward',
  'ContentInteraction', 'ContentInteractionItem', 'ContentExpectations', 'ContentJournalEntry',
  'ContentRecap', 'ContentCaseNote', 'ContentAgenda', 'ContentDebriefEntry',
  'ContentReceipt', 'ContentStaleResponse', 'ContentFacility', 'ContentToolRequirement',
  'ContentTool', 'ContentArchivedTool', 'ContentToolRepairReceiptData', 'ContentToolRepairReceipt',
  'ContentExchangeAction', 'ContentExchangeBlock', 'ContentExchangeInventoryItem',
  'ContentExchangeListing', 'ContentExchange', 'ContentExchangeListReceiptData',
  'ContentExchangeCancelReceiptData', 'ContentExchangeFillReceiptData', 'ContentExchangeReceipt']) {
  assert.equal(spec.components.schemas[name]?.additionalProperties, false,
    `${name} is a strict reusable response schema`);
}
assert.deepEqual(spec.components.schemas.ContentInstance.properties.scopeKind.enum,
  ['personal', 'crew', 'extended_family', 'invitation'], 'instance projections describe opt-in invitation scope');
const experienceSchema = spec.components.schemas.ContentBoard.properties.experiences.items;
assert.ok(experienceSchema.required.includes('location') && experienceSchema.required.includes('availableHere'),
  'experience discovery publishes its district gate and whether the caller is standing there');
for (const field of ['eligible', 'blockedBy', 'systems']) {
  assert.ok(experienceSchema.required.includes(field), `experience discovery requires ${field}`);
}
assert.ok(spec.components.schemas.ContentBoard.required.includes('storyFlags'),
  'the content board publishes the caller\'s durable authored memories');
assert.deepEqual(spec.components.schemas.ContentAction.required, ['id', 'kind'],
  'issued actions expose their opaque id and kind, not invented client authority');
assert.equal(Object.hasOwn(spec.components.schemas.ContentAction.properties, 'expectedRevision'), false,
  'the enclosing instance revision is the sole stale-state authority');
assert.equal(Object.hasOwn(spec.components.schemas.ContentMember.properties, 'characterId'), false,
  'member projections do not expose raw character identity');
assert.deepEqual(spec.components.schemas.ContentAction.properties.options.items.required,
  ['id', 'label', 'available', 'blockedBy'],
  'choice projections retain locked approaches with safe gate explanations');
assert.deepEqual(spec.components.schemas.ContentGateState.required, ['kind', 'label', 'passed'],
  'every machine gate identifier is paired with a human display label');
assert.deepEqual(spec.components.schemas.ContentGateState.properties.kind.enum, [
  'party_role', 'at_location', 'level_at_least', 'mastery_at_least', 'path_is',
  'skill_owned', 'discipline_at_least', 'honor_at_least', 'honor_at_most',
  'underworld_standing_at_least', 'crew_membership', 'season_phase_is',
  'story_flag_is', 'completed_node', 'collectible_owned',
  'source_claim', 'source_exhausted', 'inventory_cap', 'materials',
  'skill_level', 'job_active', 'facility_location', 'tool_missing', 'tool_broken', 'tool_full',
], 'the machine contract documents the entire closed authored-content gate vocabulary');
for (const field of ['pathId', 'skillId', 'disciplineId', 'npcId', 'facilityId', 'toolId']) {
  assert.ok(Object.hasOwn(spec.components.schemas.ContentGateState.properties, field),
    `ContentGateState documents its safe ${field} catalog reference`);
}
for (const path of [
  '/v1/content/{namespace}/sources/{sourceId}/collect',
  '/v1/content/{namespace}/jobs/{jobId}/start',
  '/v1/content/{namespace}/jobs/{jobId}/collect',
  '/v1/content/{namespace}/recipes/{recipeId}/craft',
  '/v1/content/{namespace}/tools/{toolId}/repair',
  '/v1/content/{namespace}/exchange/{listingId}/cancel',
  '/v1/content/{namespace}/exchange/{listingId}/fill',
]) {
  assert.deepEqual(strictBody(path).required, ['expectedContentHash'],
    `${path} requires exact active-bundle authority`);
}
for (const field of ['facilities', 'tools', 'archivedTools']) {
  assert.ok(spec.components.schemas.ContentWorkshop.required.includes(field),
    `ContentWorkshop requires its ${field} projection`);
}
assert.ok(Object.hasOwn(spec.components.schemas.ContentWorkshop.properties, 'exchange'),
  'ContentWorkshop publishes the optional authored barter board');
for (const field of ['escrowed', 'tradeable']) {
  assert.ok(spec.components.schemas.ContentInventoryItem.required.includes(field),
    `authored inventory requires its ${field} state`);
}
assert.ok(spec.components.schemas.ContentRecipe.required.includes('tools')
  && spec.components.schemas.ContentWorkOrder.required.includes('tools')
  && spec.components.schemas.ContentActiveWorkOrder.required.includes('tools'),
'recipe, work-order, and active-run projections publish tool requirements');
for (const envelope of ['ContentBoard', 'ContentReceipt']) {
  assert.equal(spec.components.schemas[envelope].properties.character.additionalProperties, true,
    `${envelope} documents the standard character snapshot envelope`);
  // The envelope carried a dead `events: []` until 2026-09-05 — nothing in src/ ever wrote to it —
  // and the contract documented it as if it were real. It is gone from both: a published field an
  // agent can never see populated is a lie in the spec (`additionalProperties: false` means a
  // schema-validating client REJECTS a response carrying it, so a resurrected slot fails here).
  assert(!Object.hasOwn(spec.components.schemas[envelope].properties, 'events'),
    `${envelope} must not document the retired \`events\` envelope slot`);
  assert(!spec.components.schemas[envelope].required.includes('events'),
    `${envelope} must not REQUIRE the retired \`events\` envelope slot`);
}
for (const field of ['nodes', 'facts', 'awards', 'notes', 'journal', 'recap', 'recapText',
  'expectations', 'suspicion', 'agenda', 'debrief', 'canReleaseRole']) {
  assert(Object.hasOwn(spec.components.schemas.ContentInstance.properties, field),
    `ContentInstance publishes the runtime ${field} projection`);
}
const publicSchema = JSON.stringify(Object.fromEntries(
  Object.entries(spec.components.schemas).filter(([name]) => name.startsWith('Content')),
));
assert.doesNotMatch(publicSchema,
  /answerSpec|acceptedAnswers|canonicalAnswer|effectPayload|rawAccount|storyFlagIds|sourceInstance/i,
  'public content schemas cannot describe private answers, effect internals, or raw account identity');

const mounted = [];
const auth = Symbol('player auth');
const modAuth = Symbol('operator auth');
const app = {
  get(url, options, handler) { mounted.push({ method: 'GET', url, options, handler }); },
  post(url, options, handler) { mounted.push({ method: 'POST', url, options, handler }); },
};
registerContentRoutes(app, { pool: Symbol('pool'), auth, modAuth });

assert.deepEqual(mounted.map(({ method, url }) => ({ method, url })), routes.map(({ method, url }) => ({ method, url })),
  'the registrar mounts exactly the approved operator and player surface');
for (const route of mounted) {
  assert.equal(typeof route.handler, 'function', `${route.method} ${route.url} has a handler`);
  assert.equal(route.options.preHandler, route.url.startsWith('/v1/mod/') ? modAuth : auth,
    `${route.method} ${route.url} uses the correct authority boundary`);
}
for (const url of ['/v1/content/:namespace/instances', '/v1/content/instances/:instanceId/join',
  '/v1/content/instances/:instanceId/act', '/v1/content/instances/:instanceId/notes',
  '/v1/content/instances/:instanceId/release']) {
  const actual = mounted.find(route => route.url === url).options.schema.body;
  const documented = strictBody(url.replace(/:([A-Za-z]+)/g, '{$1}'));
  assert.deepEqual(documented, actual, `${url} documents its actual enforced body schema`);
}

const live = Fastify();
const pass = async () => {};
registerContentRoutes(live, { pool: Symbol('unused pool'), auth: pass, modAuth: pass });
await live.ready();
for (const request of [
  { url: '/v1/content/omerta.sixth-chair/instances', payload: {
    scopeKind: 'crew', roleId: 'archivist', accountId: 'caller-chosen',
  } },
  { url: '/v1/content/instances/example/join', payload: {
    expectedRevision: '1', roleId: 'driver',
  } },
  { url: '/v1/content/instances/example/consent', payload: {
    expectedRevision: 1, on: 'true',
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', answer: 'one', choiceId: 'two',
  } },
  { url: '/v1/content/omerta.quest.rivals/instances', payload: {
    scopeKind: 'invitation', roleId: 'watcher', invitedAccountIds: ['same', 'same'],
  } },
  { url: '/v1/content/omerta.quest.rivals/instances', payload: {
    scopeKind: 'invitation', roleId: 'watcher', invitedAccountIds: 'one-account',
  } },
  { url: '/v1/content/omerta.quest.rivals/instances', payload: {
    scopeKind: 'invitation', roleId: 'watcher', invitedAccountIds: [7],
  } },
  { url: '/v1/content/instances/example/join', payload: {
    expectedRevision: 1, roleId: 'driver', agendaConsent: 'true',
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', submission: { ids: {} },
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', submission: { ids: 'first' },
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', submission: { ids: [7] },
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', submission: { ids: Array.from({ length: 65 }, (_, index) => `item-${index}`) },
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', submission: { assignments: { slot: 7 } },
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', submission: { ids: ['first'], assignments: { slot: 'first' } },
  } },
  { url: '/v1/content/instances/example/act', payload: {
    expectedRevision: 1, actionId: 'issued', hint: 'true',
  } },
  { url: '/v1/content/instances/example/notes', payload: {
    expectedRevision: 1, text: 'x'.repeat(501),
  } },
  { url: '/v1/content/instances/example/release', payload: {
    expectedRevision: 1, accountId: 'another participant',
  } },
]) {
  const response = await live.inject({ method: 'POST', ...request });
  assert.equal(response.statusCode, 400, `${request.url} enforces its documented body contract`);
}
await live.close();

const questRoutes = Object.keys(QUESTING_CONTRACTS).map(key => {
  const [method, url] = key.split(' '); return { method, url, hasAuth: true, isMod: false };
});
const questSpec = buildOpenApi(questRoutes);
for (const route of questRoutes) {
  const path = route.url.replace(/:([A-Za-z]+)/g, '{$1}');
  const operation = questSpec.paths[path][route.method.toLowerCase()];
  assert.ok(operation.operationId, `${route.url} has a named quest-service operation`);
  assert.ok(operation.responses[200].content['application/json'].schema.$ref,
    `${route.url} has a typed response rather than a generic object`);
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  if (route.method === 'POST') assert.equal(operation.requestBody.content['application/json'].schema.additionalProperties, false);
}
for (const name of ['QuestingBoard', 'QuestReadingExercise', 'QuestPracticeReceipt', 'QuestWorkshopBoard',
  'QuestWorkshopPuzzle', 'QuestWorkshopOwnDraft', 'QuestWorkshopReceipt', 'QuestWorkshopSolveReceipt',
  'QuestWorkshopRatingReceipt', 'ClueDeduction', 'ClueTrailReceipt']) {
  assert.equal(questSpec.components.schemas[name].additionalProperties, false, `${name} is closed`);
}
assert.equal(Object.hasOwn(questSpec.components.schemas.QuestWorkshopPuzzle.properties, 'culpritId'), false,
  'published mystery schemas omit the private author answer');
assert.doesNotMatch(JSON.stringify(questSpec.components.schemas.ClueDeduction), /answerId|salt|solution/,
  'clue deduction projections expose only issued options');
assert.ok(questSpec.components.schemas.ClueDeduction.required.includes('kindName'), 'the closed clue projection requires its readable kind name');
assert.deepEqual(questSpec.components.schemas.ClueDeduction.properties.kindName.enum,
  ['Surveillance timeline', 'Courier route', 'Landmark matching', 'Witness statements']);
const serviceMounted = [];
const serviceApp = {
  get(url) { serviceMounted.push(`GET ${url}`); }, post(url) { serviceMounted.push(`POST ${url}`); },
};
registerWorkshopRoutes(serviceApp, { pool: Symbol('unused pool'), auth });
registerQuestingRoutes(serviceApp, { pool: Symbol('unused pool'), auth });
assert.deepEqual([...serviceMounted].sort(), Object.keys(QUESTING_CONTRACTS).filter(key => !key.includes('/clues/')).sort(),
  'questing and workshop contracts match their real registrar surfaces');

console.log('✅ authored content API and OpenAPI contracts passed');
