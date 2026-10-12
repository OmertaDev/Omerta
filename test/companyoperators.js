process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'company-operator-isolated-regression-secret-2026';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.DEPOT_PILOT = 'on';
process.env.MARKET_SEED = 'company-operator-isolated-market-seed';
process.env.MOD_KEY = 'company-operator-isolated-mod-key';
if (process.argv.includes('--postgres')) {
  if (!process.env.COMPANY_OPERATOR_TEST_DATABASE_URL) throw new Error('Use a fresh owned COMPANY_OPERATOR_TEST_DATABASE_URL.');
  const url = new URL(process.env.COMPANY_OPERATOR_TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/company_operator_test_')) throw new Error('Only a local owned operator test database is accepted.');
  process.env.DATABASE_URL = url.href;
} else delete process.env.DATABASE_URL;
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import * as G from '../src/game.js';
import * as O from '../src/companyoperators.js';
import { setOperatingPolicy } from '../src/operatingpolicy.js';
import { runLedgerInvariants } from '../src/invariants.js';
const app = await buildServer();
const call = async (method, url, token, body) => {
  const r = await app.inject({ method, url, payload: body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(r.statusCode, 200, r.body); return r.json();
};
try {
  const token = (await call('POST', '/v1/auth/guest')).token;
  await call('POST', '/v1/character', token, { name: 'Company Cycle Owner' });
  const ch = (await call('GET', '/v1/me', token)).character;
  const account = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id;
  await app.pool.query('UPDATE characters SET cash=20000,bank=0 WHERE id=$1', [ch.id]);
  await G.ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 20000 - ch.cash - ch.bank, reason: 'pilot:capital' });
  const depotId = (await call('POST', '/v1/depot', token, { salePrice: 2000, bidPrice: 500, reorderAt: 0, targetStock: 4, restockBudget: 3000 })).id;
  await call('POST', `/v1/depot/${depotId}/fund`, token, { amount: 6000 });
  const tx = (fn) => G.withCharacter(app.pool, account, fn);
  const grant = { expectedRevision: 0, enabled: true, allowRestock: true, allowReceive: true, businessPriority: true, maxSpend: 2020, reserveCash: 1500, expiresInSeconds: 3600 };
  const policy = (await tx((c, db) => setOperatingPolicy(c, depotId, grant, db))).policy;
  const enrollment = { depotId, policyId: policy.id, expectedRevision: 0, enabled: true };
  await assert.rejects(tx((c, db) => O.setCompanyOperator(c, { ...enrollment, arbitrary: 1 }, db)), /documented/);
  await tx((c, db) => O.setCompanyOperator(c, enrollment, db));
  await assert.rejects(tx((c, db) => O.setCompanyOperator(c, enrollment, db)), /revision/);
  const request = { depotId, requestKey: 'operator-cycle-1' };
  const run = (body = request) => tx((c, db, h) => O.runCompanyOperator(c, body, db, h));
  const results = process.argv.includes('--postgres') ? await Promise.all([run(), run(), run()]) : [await run()];
  const result = results[0];
  for (const other of results) assert.deepEqual(other, result);
  assert.equal(result.action, 'restock');
  assert.equal(result.result.escrow + result.result.fee, 2020);
  const historicalReceipt = structuredClone((await app.pool.query('SELECT result FROM company_operator_receipts WHERE owner_account=$1 AND request_key=$2', [account, request.requestKey])).rows[0].result);
  assert.equal((await app.pool.query('SELECT count(*) AS n FROM company_operator_receipts')).rows[0].n, process.argv.includes('--postgres') ? '1' : 1);
  await assert.rejects(run({ ...request, depotId: 'different' }), /another operator/);
  await app.pool.query('UPDATE business_operating_policies SET enabled=false WHERE id=$1', [policy.id]);
  assert.deepEqual(await run(), result, 'revocation cannot make a retry spend again');
  await assert.rejects(run({ ...request, requestKey: 'revoked-new-key' }), /unexpired/);
  await app.pool.query('UPDATE business_operating_policies SET enabled=true WHERE id=$1', [policy.id]);
  await app.pool.query("UPDATE company_operators SET next_run_at=$2 WHERE depot_id=$1", [depotId, new Date(Date.now() - 1000)]);
  await app.pool.query('UPDATE business_depots SET bid_price=501 WHERE id=$1', [depotId]);
  await assert.rejects(run({ ...request, requestKey: 'drift' }), /unchanged/);
  await app.pool.query('UPDATE business_depots SET bid_price=500 WHERE id=$1', [depotId]);
  await assert.rejects(run({ ...request, requestKey: 'pending' }), /No authorized/);
  const supplier = (await call('POST', '/v1/auth/guest')).token;
  await call('POST', '/v1/character', supplier, { name: 'Operator Supplier' });
  const supplierCh = (await call('GET', '/v1/me', supplier)).character;
  await app.pool.query('UPDATE characters SET cash=10000,bank=0,loc=$2 WHERE id=$1', [supplierCh.id, ch.loc]);
  await G.ledger(app.pool, { characterId: supplierCh.id, currency: 'cash', amount: 10000 - supplierCh.cash - supplierCh.bank, reason: 'pilot:capital' });
  await call('POST', '/v1/goods/buy', supplier, { goodId: 'gin', qty: 2 });
  await call('POST', `/v1/market/${result.result.id}/fill`, supplier, { qty: 2 });
  const received = await run({ ...request, requestKey: 'receive-1' });
  assert.equal(received.action, 'receive'); assert.equal(received.result.received, 2);
  assert.deepEqual(await run({ ...request, requestKey: 'receive-1' }), received);
  await app.pool.query('UPDATE company_operators SET next_run_at=$2 WHERE depot_id=$1', [depotId, new Date(Date.now() - 1000)]);
  if (process.argv.includes('--postgres')) {
    await call('POST', '/v1/goods/buy', supplier, { goodId: 'gin', qty: 2 });
    await call('POST', `/v1/market/${result.result.id}/fill`, supplier, { qty: 2 });
    await assert.rejects(tx((c, db, h) => O.runCompanyOperator(c, { ...request, requestKey: 'rollback' }, {
      query: (sql, args) => {
        if (sql.startsWith('INSERT INTO company_operator_receipts')) throw new Error('injected receipt failure');
        return db.query(sql, args);
      },
    }, h)), /injected/);
    assert.equal(Number((await app.pool.query('SELECT stock FROM business_depots WHERE id=$1', [depotId])).rows[0].stock), 2);
    assert.equal(Number((await app.pool.query('SELECT filled_qty FROM market_listings WHERE id=$1', [result.result.id])).rows[0].filled_qty), 2);
    const race = await Promise.allSettled([
      run({ ...request, requestKey: 'receive-race-a' }), run({ ...request, requestKey: 'receive-race-b' }),
    ]);
    assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(Number((await app.pool.query('SELECT stock FROM business_depots WHERE id=$1', [depotId])).rows[0].stock), 4);
    await app.pool.query('UPDATE company_operators SET next_run_at=$2 WHERE depot_id=$1', [depotId, new Date(Date.now() - 1000)]);
  }
  assert.equal((await O.companyOperatorBoard(app.pool, account)).length, 1);
  assert.equal((await O.companyOperatorBoard(app.pool, 'another-account')).length, 0);
  assert.equal((await O.dueCompanyOperators(app.pool, 1)).length, 1);
  await assert.rejects(O.dueCompanyOperators(app.pool, 101), /Bound/);
  const original = { ...(await app.pool.query('SELECT * FROM characters WHERE id=$1', [ch.id])).rows[0] };
  await assert.rejects(O.runCompanyOperator({ ...original, alive: false }, { ...request, requestKey: 'dead' }, app.pool, {}), /living/);
  assert.deepEqual(await O.runCompanyOperator({ ...original, id: 'heir' }, request, app.pool, {}), historicalReceipt,
    'the original account may recover an old receipt without invoking new authority');
  await assert.rejects(O.runCompanyOperator({ ...original, id: 'heir' }, { ...request, requestKey: 'heir-fresh' }, app.pool, {}), /owner/);
  const beforePrice = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [depotId])).rows[0];
  const beforePolicy = (await app.pool.query('SELECT * FROM business_operating_policies WHERE id=$1', [policy.id])).rows[0];
  const pricePolicy = { minSalePrice: 800, maxSalePrice: 1200, targetMarginBps: 5000, expiresInSeconds: 600 };
  await assert.rejects(tx((c, db) => O.setCompanyOperator(c, { ...enrollment, expectedRevision: 1, pricePolicy: { ...pricePolicy, maxSpend: 100000 } }, db)), /documented/);
  await assert.rejects(tx((c, db) => O.setCompanyOperator(c, { ...enrollment, expectedRevision: 1, pricePolicy: { ...pricePolicy, minSalePrice: 50, maxSalePrice: 100 } }, db)), /margin/);
  await tx((c, db) => O.setCompanyOperator(c, { ...enrollment, expectedRevision: 1, pricePolicy }, db));
  const priceRequest = { ...request, requestKey: 'owner-consented-price' };
  const prices = process.argv.includes('--postgres') ? await Promise.all([run(priceRequest), run(priceRequest)]) : [await run(priceRequest)];
  assert.equal(prices[0].action, 'reprice'); assert.equal(prices[0].result.salePrice, 800);
  for (const price of prices) assert.deepEqual(price, prices[0]);
  const afterPrice = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [depotId])).rows[0];
  for (const field of ['bid_price', 'target_stock', 'reorder_at', 'restock_budget', 'treasury', 'stock'])
    assert.equal(Number(afterPrice[field]), Number(beforePrice[field]), `price consent cannot change ${field}`);
  const afterPolicy = (await app.pool.query('SELECT * FROM business_operating_policies WHERE id=$1', [policy.id])).rows[0];
  for (const field of ['spent', 'max_spend', 'reserve_cash']) assert.equal(Number(afterPolicy[field]), Number(beforePolicy[field]));
  await app.pool.query('UPDATE business_depots SET sale_price=2000 WHERE id=$1', [depotId]);
  const expiredPrice = { minSalePrice: 800, maxSalePrice: 1200, targetMarginBps: 5000, expiresAt: new Date(Date.now() - 1000).toISOString() };
  await app.pool.query('UPDATE company_operators SET price_policy=$2,next_run_at=$3 WHERE depot_id=$1', [depotId, JSON.stringify(expiredPrice), new Date(Date.now() - 1000)]);
  await assert.rejects(run({ ...request, requestKey: 'expired-price' }), /No authorized/);
  assert.deepEqual(await run(priceRequest), prices[0], 'price replay is independent of consent expiry');
  if (process.argv.includes('--postgres')) {
    const blocker = await app.pool.connect();
    await app.pool.query('UPDATE business_operating_policies SET expires_at=$2 WHERE id=$1', [policy.id, new Date(Date.now() + 500)]);
    await blocker.query('BEGIN');
    await blocker.query('SELECT depot_id FROM company_operators WHERE depot_id=$1 FOR UPDATE', [depotId]);
    const waiting = run({ ...request, requestKey: 'expiry-after-lock' });
    const rejected = assert.rejects(waiting, /unexpired/);
    try {
      let observed = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const rows = (await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM company_operators%' LIMIT 1")).rows;
        if (rows.length) { observed = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      assert.equal(observed, true, 'native runner is observed waiting for the operator row');
      await new Promise((resolve) => setTimeout(resolve, 550));
      await blocker.query('COMMIT');
      await rejected;
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  } else await app.pool.query('UPDATE business_operating_policies SET expires_at=$2 WHERE id=$1', [policy.id, new Date(Date.now() - 1000)]);
  await assert.rejects(run({ ...request, requestKey: 'expired' }), /unexpired/);
  assert.deepEqual(await run(), result);
  const inv = await runLedgerInvariants(app.pool, { alert: false });
  assert.equal(inv.checks.filter((r) => !r.ok).length, 0, JSON.stringify(inv.checks.filter((r) => !r.ok)));
  console.log(`company operators: canonical restock/receive/reprice, explicit finite price consent, unchanged spending terms, identity, replay, revocation, expiry, bounds and ledger invariants passed${process.argv.includes('--postgres') ? '; native duplicate/distinct-key races and atomic rollback passed' : ''}`);
} finally { await app.close(); }
