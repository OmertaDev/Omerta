// Scripted synthetic actors in one disposable city. This is an integration/authority test,
// not a claim that real people or independent language models completed these interactions.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Local coordination scenarios require a disposable database.');
process.env.NODE_ENV = 'test'; process.env.RATE_LIMIT = 'off';
const app = await buildServer(), pool = app.pool;
let requests = 0;
const call = async (actor, method, url, payload, key = crypto.randomUUID()) => {
  requests++;
  const response = await app.inject({ method, url, payload, headers: {
    ...(actor ? { authorization: `Bearer ${actor.token}` } : {}), 'Idempotency-Key': key,
  } });
  return { code: response.statusCode, body: response.json() };
};
const ok = async (...args) => {
  const result = await call(...args); assert.equal(result.code, 200, JSON.stringify(result.body)); return result.body;
};
const create = async (name, agent) => {
  const admitted = await ok(null, 'POST', agent ? '/v1/auth/agent' : '/v1/auth/guest',
    agent ? { bootstrapSecret: crypto.randomBytes(32).toString('base64url') } : { birthDate: '1990-01-01' });
  const actor = { token: admitted.token, name };
  if (agent) await ok(actor, 'POST', '/v1/auth/guest/bootstrap/ack', {});
  await ok(actor, 'POST', '/v1/character', { name });
  actor.id = (await ok(actor, 'GET', '/v1/me')).character.id;
  assert.equal((await ok(actor, 'GET', '/v1/session')).agent, agent);
  await pool.query("UPDATE characters SET respect=5000,cash=50000,loc='docks' WHERE id=$1", [actor.id]);
  return actor;
};
const cash = async actor => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [actor.id])).rows[0].cash);
const cargo = async actor => Number((await pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [actor.id])).rows[0]?.qty || 0);

try {
  const [first, second, human, outsider] = await Promise.all([
    create('Local Agent Captain', true), create('Local Agent Partner', true),
    create('Local Human Author', false), create('Local Human Bystander', false),
  ]);
  for (const target of [second, human]) await ok(first, 'POST', `/v1/streets/${target.id}/meet`, {});
  const crew = await ok(first, 'POST', '/v1/crew', { name: 'Local Consent Circle' });
  for (const target of [second, human]) await ok(first, 'POST', '/v1/crew/invite', { name: target.name });
  const pending = await ok(human, 'GET', '/v1/crew');
  assert.equal(pending.crew, null, 'an invitation does not consent to membership');
  assert.equal(pending.invites.length, 1);
  const uninvited = await call(outsider, 'POST', `/v1/crew/accept/${crew.id}`, {});
  assert.equal(uninvited.body.error, 'no_invite', 'a third party cannot accept somebody else’s invitation');
  await Promise.all([second, human].map(actor => ok(actor, 'POST', `/v1/crew/accept/${crew.id}`, {})));
  assert.equal((await ok(first, 'GET', '/v1/crew')).crew.members.length, 3);
  const privateNote = 'LOCAL FIXTURE: the three consenting actors share this plan.';
  await ok(first, 'POST', '/v1/crew/chat', { text: privateNote });
  assert((await ok(second, 'GET', '/v1/crew/chat')).messages.some(message => message.text === privateNote));
  assert((await ok(human, 'GET', '/v1/crew/chat')).messages.some(message => message.text === privateNote));
  const hidden = await call(outsider, 'GET', '/v1/crew/chat');
  assert.equal(hidden.code, 200); assert.deepEqual(hidden.body.messages, [], 'an outsider receives an empty room, not another crew’s notes');
  assert(!JSON.stringify(hidden.body).includes(privateNote));

  // Seed inventory only as a local fixture, then exercise actual escrow/consent/idempotent pickup.
  await pool.query("INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,'gin',3)", [first.id]);
  const buyerCash = await cash(human);
  const listing = await ok(first, 'POST', '/v1/market', { goodId: 'gin', qty: 2, price: 500 });
  assert.equal(await cargo(first), 1, 'listing escrows goods from the seller');
  assert.equal(await cash(human), buyerCash, 'a public offer never charges an unconsenting buyer');
  assert((await call(second, 'POST', `/v1/market/${listing.id}/cancel`, {})).code >= 400,
    'another agent cannot cancel the seller’s offer');
  const purchaseKey = crypto.randomUUID();
  const bought = await ok(human, 'POST', `/v1/market/${listing.id}/buy`, { qty: 2 }, purchaseKey);
  assert.equal(bought.qty, 2); assert.equal(bought.paid, 1000);
  await ok(human, 'POST', `/v1/market/${listing.id}/buy`, { qty: 2 }, purchaseKey);
  assert.equal(await cargo(human), 2, 'an exact purchase retry cannot transfer twice');
  assert.equal(await cash(human), buyerCash - 1000, 'an exact purchase retry cannot charge twice');

  const actors = [first, second, human, outsider];
  const balances = await Promise.all(actors.map(cash));
  const definition = { title: 'Local Witness Ledger', templateId: 'missing-ledger', sceneId: 'docks',
    culpritId: 'courier', clueIds: ['courier_at_docks', 'tailor_at_canal'] };
  const draft = (await ok(human, 'POST', '/v1/quest-workshop', definition)).mystery;
  assert.equal((await call(second, 'GET', `/v1/quest-workshop/${draft.id}`)).code, 404, 'unpublished authorship stays private');
  assert.equal((await call(first, 'POST', `/v1/quest-workshop/${draft.id}/publish`, {})).code, 404, 'another agent cannot publish a human’s draft');
  await ok(human, 'POST', `/v1/quest-workshop/${draft.id}/publish`, {});
  const publicCase = await ok(outsider, 'GET', `/v1/quest-workshop/${draft.id}`);
  assert(!/culpritId|culprit_id|author_account_id/.test(JSON.stringify(publicCase)), 'public play contains evidence without the answer or private author ID');
  assert.equal((await call(second, 'POST', `/v1/quest-workshop/${draft.id}/rate`, { stars: 5 })).body.error, 'workshop_not_solved');
  assert.equal((await call(human, 'POST', `/v1/quest-workshop/${draft.id}/solve`, { suspectId: 'courier' })).body.error, 'workshop_author');
  assert.equal((await ok(second, 'POST', `/v1/quest-workshop/${draft.id}/solve`, { suspectId: 'courier' })).solved, true);
  assert.equal((await ok(second, 'POST', `/v1/quest-workshop/${draft.id}/rate`, { stars: 5 })).myRating, 5);
  assert.deepEqual(await Promise.all(actors.map(cash)), balances, 'social authorship/solving/rating creates no currency faucet');
  console.log(JSON.stringify({ localOnly: true, syntheticAgents: 2, syntheticHumans: 2, requests,
    explicitCrewConsent: true, privateCrewNotes: true, escrowTradeAndRetry: true,
    privateHumanDraft: true, agentSolvesPublishedHumanCase: true, authoringValueNeutral: true }));
} finally { await app.close(); }
