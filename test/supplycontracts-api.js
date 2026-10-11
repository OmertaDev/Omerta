import assert from 'node:assert/strict';
process.env.RATE_LIMIT = 'off';
process.env.DEPOT_PILOT = 'on';
process.env.SOCIAL_VERIFY_MODE = 'off';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  assert(process.env.SUPPLY_TEST_DATABASE_URL, 'Provide a dedicated disposable supply database.');
  const database = new URL(process.env.SUPPLY_TEST_DATABASE_URL);
  assert.equal(database.hostname, '127.0.0.1');
  assert.match(database.pathname, /^\/game_supply_[a-z0-9_]+$/);
  process.env.DATABASE_URL = process.env.SUPPLY_TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'supply-disposable-test-secret-only-20261011';
  process.env.MARKET_SEED = 'supply-disposable-test-market';
  process.env.MOD_KEY = 'supply-disposable-test-moderator';
  process.env.INVITE_MODE = 'off';
} else assert(!process.env.DATABASE_URL, 'Memory checks cannot use a configured database.');
const { buildServer } = await import('../src/server.js');
const { ledger } = await import('../src/game.js');
const app = await buildServer();
let sequence = 0;
const call = async (method, url, token, payload) => {
  const reply = await app.inject({ method, url, payload, headers: {
    ...(token ? { authorization: 'Bearer ' + token } : {}),
    'idempotency-key': 'supply-api-' + Date.now() + '-' + (++sequence),
  } });
  return { code: reply.statusCode, body: reply.json() };
};
try {
  const owner = (await call('POST', '/v1/auth/guest', null, { birthDate: '1990-01-01' })).body.token;
  const created = await call('POST', '/v1/character', owner, { name: 'Supply ' + Date.now().toString(36) });
  assert.equal(created.code, 200, JSON.stringify(created.body));
  const character = (await call('GET', '/v1/me', owner)).body.character;
  const agent = (await call('POST', '/v1/auth/agent-key', owner)).body.token;
  await app.pool.query('UPDATE characters SET cash=30000,bank=0 WHERE id=$1', [character.id]);
  await ledger(app.pool, { characterId: character.id, currency: 'cash', amount: 30000 - character.cash - character.bank, reason: 'pilot:capital' });
  const opened = await call('POST', '/v1/depot', owner, { salePrice: 2000, bidPrice: 500, reorderAt: 0, targetStock: 4, restockBudget: 3000 });
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  const id = opened.body.id, path = '/v1/depot/' + id;
  assert.equal((await call('POST', path + '/fund', owner, { amount: 10000 })).code, 200);
  const grant = { expectedRevision: 0, enabled: true, allowRestock: true, allowReceive: true,
    businessPriority: true, maxSpend: 9000, reserveCash: 1500, expiresInSeconds: 86400 };
  const approved = await call('POST', path + '/policy', owner, grant);
  assert.equal(approved.code, 200, JSON.stringify(approved.body));
  const policyId = approved.body.policy.id;
  const cadence = { expectedRevision: 0, enabled: true, intervalSeconds: 3600, maxCycles: 2, expiresInSeconds: 86400 };
  assert.equal((await call('POST', path + '/supply-contract', agent, cadence)).body.error, 'owner_authority');
  assert.equal((await call('POST', path + '/supply-contract', owner, cadence)).code, 200);
  assert.equal((await call('POST', path + '/supply-contract', owner, cadence)).body.error, 'supply_contract');
  const first = await call('POST', path + '/restock', agent, { policyId });
  assert.equal(first.code, 200, JSON.stringify(first.body));
  let state = (await call('GET', '/v1/depot', owner)).body.depot;
  assert.equal(state.supplyContract.dispatched, 1);
  assert.equal(state.automatedRestockQuote, null);
  assert.equal((await call('POST', path + '/orders/' + first.body.id + '/cancel', owner)).code, 200);
  assert.equal((await call('POST', path + '/restock', agent, { policyId })).body.error, 'supply_contract');
  state = (await call('GET', '/v1/depot', owner)).body.depot;
  assert.equal(state.operatingPolicy.spent, first.body.escrow + first.body.fee, 'Refunds do not replenish procurement authority.');
  await app.pool.query('UPDATE business_supply_contracts SET next_dispatch_at=$2 WHERE depot_id=$1 AND enabled', [id, new Date(Date.now() - 1000)]);
  const results = postgres ? await Promise.all([
    call('POST', path + '/restock', agent, { policyId }), call('POST', path + '/restock', agent, { policyId }),
  ]) : [await call('POST', path + '/restock', agent, { policyId })];
  assert.equal(results.filter(result => result.code === 200).length, 1, 'Only one due order can consume one cycle.');
  state = (await call('GET', '/v1/depot', owner)).body.depot;
  assert.equal(state.supplyContract.dispatched, 2);
  assert.equal(state.supplyContract.remainingCycles, 0);
  assert.equal(state.orders.length, 1);
  const second = results.find(result => result.code === 200).body;
  assert.equal(state.operatingPolicy.spent, first.body.escrow + first.body.fee + second.escrow + second.fee);
  assert.equal((await call('POST', path + '/orders/' + second.id + '/cancel', owner)).code, 200);
  assert.equal((await call('POST', path + '/restock', agent, { policyId })).body.error, 'supply_contract');
  const manual = await call('POST', path + '/restock', owner);
  assert.equal(manual.code, 200, 'An exhausted optional cadence does not remove manual owner authority.');
  assert.equal((await call('POST', path + '/orders/' + manual.body.id + '/cancel', owner)).code, 200);
  assert.equal((await call('POST', path + '/supply-contract', owner, { ...cadence, expectedRevision: 1 })).code, 200);
  await app.pool.query('UPDATE business_supply_contracts SET expires_at=$2 WHERE depot_id=$1 AND enabled', [id, new Date(Date.now() - 1000)]);
  assert.equal((await call('POST', path + '/restock', agent, { policyId })).body.error, 'supply_contract');
  assert.equal((await call('POST', path + '/supply-contract', owner, { ...cadence, expectedRevision: 2 })).code, 200);
  const reauthorized = await call('POST', path + '/policy', owner, { ...grant, expectedRevision: 1 });
  assert.equal(reauthorized.code, 200);
  assert.equal((await call('POST', path + '/restock', agent, { policyId: reauthorized.body.policy.id })).body.error, 'supply_contract');
  assert.equal((await call('GET', '/v1/depot', owner)).body.depot.automatedRestockQuote, null, 'Reauthorization requires an explicit cadence revision.');
  assert.equal((await call('POST', path + '/supply-contract', owner, { ...cadence, expectedRevision: 3 })).code, 200);
  if (postgres) {
    const before = (await call('GET', '/v1/depot', owner)).body.depot;
    const originalConnect = app.pool.connect.bind(app.pool), clients = new Map();
    app.pool.connect = (...args) => {
      if (typeof args[0] === 'function') return originalConnect(...args);
      return originalConnect(...args).then(client => {
      if (!clients.has(client)) {
        const query = client.query;
        clients.set(client, query);
        client.query = function (sql, ...values) {
          if (typeof sql === 'string' && sql.startsWith('UPDATE business_supply_contracts SET dispatched='))
            return Promise.reject(new Error('Injected supply dispatch persistence failure'));
          return query.call(this, sql, ...values);
        };
      }
      return client;
      });
    };
    let failure;
    try { failure = await call('POST', path + '/restock', agent, { policyId: reauthorized.body.policy.id }); }
    finally { app.pool.connect = originalConnect; for (const [client, query] of clients) client.query = query; }
    assert.equal(failure.code, 500);
    const after = (await call('GET', '/v1/depot', owner)).body.depot;
    assert.equal(after.treasury, before.treasury);
    assert.equal(after.operatingPolicy.spent, before.operatingPolicy.spent);
    assert.equal(after.supplyContract.dispatched, before.supplyContract.dispatched);
    assert.equal(after.orders.length, 0, 'Order, escrow, policy spend and cadence rollback together.');
  }
  console.log('Supply API: owner controls, due cycles, refund/spend conservation, expiry, policy drift and manual authority passed' + (postgres ? '; native concurrent dispatch and atomic rollback passed.' : '.'));
} finally { await app.close(); }
