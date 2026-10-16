import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { SHOPPING_BASKET_CONTRACTS as contracts, SHOPPING_BASKET_SCHEMAS } from '../src/shoppingbasket-contracts.js';
import { CONSIGNMENT_SCHEMAS } from '../src/consignment-contracts.js';
import { fixture } from './shoppingbasket-fixture.js';
const f = await fixture(true), { app, pool, pair, quoteBody, ref, books } = f;
const schemas = { ...CONSIGNMENT_SCHEMAS, ...SHOPPING_BASKET_SCHEMAS }, ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
const validators = Object.fromEntries(Object.entries(contracts).map(([key, c]) => [key, ajv.compile({ ...c.responseSchema, components: { schemas } })]));
const tokens = Object.fromEntries(['seller-a', 'seller-b', 'host', 'buyer', 'other'].map(account => [account,
  { human: app.jwt.sign({ sub: account, tv: 0 }), agent: app.jwt.sign({ sub: account, tv: 0, agent: true }) }]));
let serial = 0;
const call = (account, action, body, key = 'basket-http-' + (++serial), agent = true) => app.inject({ method: body === undefined ? 'GET' : 'POST',
  url: '/v1/items/shopping-baskets' + (action ? '/' + action : ''), payload: body,
  headers: { ...(account ? { authorization: 'Bearer ' + tokens[account][agent ? 'agent' : 'human'] } : {}), 'idempotency-key': key } });
const ok = async (...args) => {
  const response = await call(...args); assert.equal(response.statusCode, 200, response.body);
  const route = (args[2] === undefined ? 'GET ' : 'POST ') + '/v1/items/shopping-baskets' + (args[1] ? '/' + args[1] : '');
  const validate = validators[route]; assert(validate(response.json()), JSON.stringify(validate.errors));
  assert(!validate({ ...response.json(), unknownAuthority: true })); return response.json();
};
try {
  assert.equal((await call(null, '')).statusCode, 401);
  const lines = await pair(), body = quoteBody(lines), quote = await ok('buyer', 'quote', body, 'quote', true);
  assert.deepEqual(await ok('buyer', 'quote', body, 'quote', false), quote, 'Human and agent share exact original account scope and replay');
  const board = await ok('buyer', '', undefined, 'board', false); assert.equal(board.baskets.length, 1);
  assert(!JSON.stringify(board).includes(lines[0].itemId)); assert(!JSON.stringify(board).includes('seller-a-actor'));
  assert.equal((await ok('other', '')).baskets.length, 0);
  assert.equal((await call('other', 'checkout', ref(quote))).statusCode, 400);
  assert.equal((await call('buyer', 'checkout', { ...ref(quote), loyaltyContext: {} })).statusCode, 400);
  const paid = await ok('buyer', 'checkout', ref(quote), 'checkout', false);
  assert.deepEqual(await ok('buyer', 'checkout', ref(quote), 'checkout', true), paid); assert.equal(paid.sales.length, 2); await books();
  await pool.query("UPDATE accounts SET token_version=1 WHERE id='other'"); assert.equal((await call('other', '')).statusCode, 401);
  await pool.query("UPDATE accounts SET status='banned' WHERE id='buyer'"); assert.equal((await call('buyer', '')).statusCode, 403);
  console.log('Shopping basket canonical registered HTTP PASS: existing human/agent auth/JWT parity/revocation, private quotes/closed DTOs, no caller pricing, real2UID/6journals and exact replay.');
} finally { await app.close(); }
