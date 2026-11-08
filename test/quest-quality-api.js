import assert from 'node:assert/strict';
import Fastify from 'fastify';
import Ajv from 'ajv';
import { buildOpenApi } from '../src/agentgateway.js';
import { register } from '../src/routes/content.js';
import { qualityFixture } from './lib/quest-quality-fixture.js';

const f = await qualityFixture(), app = Fastify();
const auth = async (request, reply) => {
  if (!request.headers['x-test-account']) return reply.code(401).send({ error: 'unauthorized' });
  request.user = { sub: request.headers['x-test-account'] };
};
app.setErrorHandler((error, _request, reply) => reply.code(error.statusCode || 400).send({ error: error.code, message: error.message }));
register(app, { pool: f.pool, auth, modAuth: auth });
const spec = buildOpenApi([{ method: 'POST', url: '/v1/content/instances/:instanceId/quality', hasAuth: true, isMod: false }]);
const validate = new Ajv({ strict: false, validateFormats: false }).compile({
  components: spec.components, $ref: '#/components/schemas/ContentReceipt',
});
try {
  const who = await f.identity('Quality API'), other = await f.identity('Quality API outsider');
  let board = await f.start(who, 'three-witnesses');
  const url = `/v1/content/instances/${board.instance.id}/quality`;
  const body = (operation, fields = {}) => ({ operation, expectedRevision: board.instance.revision,
    expectedQualityRevision: board.instance.quality.revision, ...fields });
  const post = (payload, account = who.accountId) => app.inject({ method: 'POST', url, payload,
    headers: account ? { 'x-test-account': account } : {} });
  const payload = body('save_draft', { text: 'A private draft survives validation.', evidenceIds: [] });
  assert.equal((await post(payload, null)).statusCode, 401);
  assert.equal((await post(payload, other.accountId)).statusCode, 400);
  const saved = await post(payload);
  assert.equal(saved.statusCode, 200, saved.body);
  board = saved.json();
  assert.equal(board.instance.quality.draft.text, payload.text, 'Trying other schema branches must not strip valid draft fields.');
  assert(validate(board), JSON.stringify(validate.errors));
  assert.equal((await post(payload)).statusCode, 409, 'Stale private revisions return an authoritative replacement.');
  for (const invalid of [
    body('save_draft', { text: 'Typed', evidenceIds: [], actorAccountId: other.accountId }),
    body('save_draft', { text: 123, evidenceIds: [] }),
    body('save_draft', { text: 'Typed', evidenceIds: [], npcId: 'unrelated-operation' }),
    body('study_consent', { consent: 'true', evidenceType: 'ai', familiarity: 'new' }),
    body('study_comprehension', { answers: { what: 'x', why: 'y', next: 'z', extra: 'strip-me' } }),
    body('study_comprehension', { answers: { what: 9, why: 'y', next: 'z' } }),
    body('study_recall', { memory: 'x', enjoyment: '5', understanding: 5 }),
    body('invented-operation'),
  ]) assert.equal((await post(invalid)).statusCode, 400, `Refuse invalid quality request ${JSON.stringify(invalid)}`);
  const enrolled = await post(body('study_consent', { consent: true, evidenceType: 'ai', familiarity: 'new' }));
  assert.equal(enrolled.statusCode, 200, enrolled.body); board = enrolled.json();
  assert.equal(board.instance.quality.study.evidenceType, 'ai');
  assert(validate(board), JSON.stringify(validate.errors));
  const exactFields = spec.paths['/v1/content/instances/{instanceId}/quality'].post.requestBody.content['application/json'].schema;
  assert.equal(exactFields.additionalProperties, false);
  assert.deepEqual(spec.paths['/v1/content/instances/{instanceId}/quality'].post.security, [{ bearerAuth: [] }]);
  assert(!JSON.stringify(board.instance.quality).includes('"outcomes"'));
  console.log('quest quality API: strict uncoerced operation bodies, schema mutation regression, membership, stale replacement and typed private receipts passed');
} finally { await app.close(); await f.pool.end(); }
