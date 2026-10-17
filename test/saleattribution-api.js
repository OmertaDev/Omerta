import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { SALE_ATTRIBUTION_CONTRACTS as contracts, SALE_ATTRIBUTION_SCHEMAS } from '../src/saleattribution-contracts.js';
import { CONSIGNMENT_SCHEMAS } from '../src/consignment-contracts.js';
import { fixture } from './saleattribution-fixture.js';
const f = await fixture(true), { app, pool, list, ref, attributionRef, books } = f;
const schemas = { ...CONSIGNMENT_SCHEMAS, ...SALE_ATTRIBUTION_SCHEMAS }, ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
const validators = Object.fromEntries(Object.entries(contracts).map(([key, c]) => [key, ajv.compile({ ...c.responseSchema, components: { schemas } })]));
const tokens = Object.fromEntries(['owner', 'host', 'buyer', 'other'].map(account => [account,
  { human: app.jwt.sign({ sub: account, tv: 0 }), agent: app.jwt.sign({ sub: account, tv: 0, agent: true }) }]));
let serial = 0;
const call = (account, action, body, key = 'api-' + (++serial), agent = true) => app.inject({ method: body === undefined ? 'GET' : 'POST',
  url: '/v1/sale-attribution' + (action ? '/' + action : ''), payload: body,
  headers: { ...(account ? { authorization: 'Bearer ' + tokens[account][agent ? 'agent' : 'human'] } : {}), 'idempotency-key': key } });
const ok = async (...args) => {
  const response = await call(...args); assert.equal(response.statusCode, 200, response.body);
  const route = (args[2] === undefined ? 'GET ' : 'POST ') + '/v1/sale-attribution' + (args[1] ? '/' + args[1] : '');
  const validate = validators[route]; assert(validate(response.json()), JSON.stringify(validate.errors));
  assert(!validate({ ...response.json(), unexpected: true }), 'closed response refuses unknown authority/data fields');
  return response.json();
};
try {
  assert.equal((await call(null, '')).statusCode, 401);
  const sale = await list(), campaign = await ok('owner', 'open', sale.open, 'open', true);
  assert.deepEqual(await ok('owner', 'open', sale.open, 'open', false), campaign, 'human and agent use same original account replay domain');
  assert.equal((await call('owner', 'accept', ref(campaign))).statusCode, 400);
  await ok('other', 'accept', ref(campaign), 'accept', false);
  const board = await ok('buyer', '', undefined, 'board', false);
  assert(!JSON.stringify(board).includes(sale.itemId)); assert(!JSON.stringify(board).includes('owner-actor'));
  const attribution = await ok('buyer', 'attribute', ref(campaign), 'attribute', true);
  assert.equal((await call('buyer', 'buy', { ...attributionRef(attribution), publisherAccountId: 'buyer' })).statusCode, 400);
  const bought = await ok('buyer', 'buy', attributionRef(attribution), 'buy', false);
  assert.deepEqual(await ok('buyer', 'buy', attributionRef(attribution), 'buy', true), bought);
  assert.equal(bought.sale.paid, 101); assert.equal(bought.commissionCash, 17); await books();
  await pool.query("UPDATE accounts SET token_version=1 WHERE id='other'");
  assert.equal((await call('other', '')).statusCode, 401);
  await pool.query("UPDATE accounts SET status='banned' WHERE id='owner'");
  assert.equal((await call('owner', '')).statusCode, 403);
  console.log('Sale attribution registered canonical HTTP/auth PASS: human/agent JWT parity, revocation/banned accounts, no authority override, closed DTOs, original sale + reserved commission, exact replay.');
} finally { await app.close(); }
