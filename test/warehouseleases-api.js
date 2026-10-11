process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'warehouse-local-test-secret-only';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.MOD_KEY = 'warehouse-local-test-mod';
process.env.DEPOT_PILOT = 'on';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.WAREHOUSE_TEST_DATABASE_URL || 'http://missing');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/warehouse_leases_'))
    throw new Error('Use an isolated local warehouse_leases_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
  process.env.MARKET_SEED = 'warehouse-local-test-seed';
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
import { runLedgerInvariants } from '../src/invariants.js';
const app = await buildServer();
let seq = 0;
const call = async (method, url, player, body, key = `warehouse-${++seq}`) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(player ? { authorization: `Bearer ${player.token}` } : {}), 'idempotency-key': key } });
  return { code: response.statusCode, body: response.json() };
};
const create = async name => {
  const ownerToken = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', { token: ownerToken })).body.token;
  const p = { token, ownerToken };
  assert.equal((await call('POST', '/v1/character', p, { name })).code, 200);
  const ch = (await call('GET', '/v1/me', p)).body.character;
  p.id = ch.id;
  await app.pool.query('UPDATE characters SET cash=50000 WHERE id=$1', [p.id]);
  await ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 50000 - ch.cash, reason: 'crime:warehouse-fixture' });
  return p;
};
const open = async p => {
  const opened = await call('POST', '/v1/depot', p, { salePrice: 2000, bidPrice: 123, targetStock: 4, reorderAt: 0, restockBudget: 3000 });
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  const id = opened.body.id;
  assert.equal((await call('POST', `/v1/depot/${id}/warehouse-offer`, p,
    { expectedRevision: 0, enabled: true, slots: 10, cashPerUnitDay: 25 })).code, 200);
  return id;
};
const cargo = async p => Number((await app.pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [p.id])).rows[0]?.qty || 0);
const lease = async id => (await app.pool.query('SELECT * FROM business_warehouse_leases WHERE id=$1', [id])).rows[0];
const kill = async p => {
  const result = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: p.id }, headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(result.statusCode, 200, result.body);
};
const checks = async () => {
  const result = await runLedgerInvariants(app.pool, { alert: false });
  assert.deepEqual(result.checks.filter(c => (c.name.startsWith('warehouse ') || c.name.startsWith('depot ') || c.name === 'character cash') && !c.ok), []);
};
try {
  const landlord = await create('Warehouse Landlord'), tenant = await create('Warehouse Tenant'), other = await create('Warehouse Stranger');
  const depot = await open(landlord);
  assert.equal((await call('GET', '/v1/warehouses')).code, 401);
  const terms = { units: 10, expectedOfferRevision: 1, maxTotalCash: 250 };
  assert.equal((await call('POST', `/v1/warehouses/${depot}/lease`, landlord, terms)).body.error, 'self');
  const rented = await call('POST', `/v1/warehouses/${depot}/lease`, tenant, terms, 'warehouse-rent-retry');
  assert.equal(rented.code, 200, JSON.stringify(rented.body));
  const id = rented.body.lease.id;
  assert.deepEqual(await call('POST', `/v1/warehouses/${depot}/lease`, tenant, terms, 'warehouse-rent-retry'), rented);
  assert.equal(Number((await lease(id)).fee_cash), 250);
  assert.equal((await call('GET', '/v1/warehouses', other)).body.leases.length, 0, 'lease ownership is private');
  assert.equal((await call('POST', `/v1/warehouse-leases/${id}/deposit`, other, { qty: 1 })).body.error, 'not_yours');
  assert.equal((await call('POST', `/v1/depot/${depot}/close`, landlord)).body.error, 'depot_obligations', 'paid active lease blocks voluntary closure');
  assert.equal((await call('POST', '/v1/goods/buy', tenant, { goodId: 'gin', qty: 4 })).code, 200);
  const deposited = await call('POST', `/v1/warehouse-leases/${id}/deposit`, tenant, { qty: 3 }, 'warehouse-deposit-retry');
  assert.equal(deposited.code, 200);
  assert.deepEqual(await call('POST', `/v1/warehouse-leases/${id}/deposit`, tenant, { qty: 3 }, 'warehouse-deposit-retry'), deposited);
  assert.equal(await cargo(tenant), 1);
  assert.equal(Number((await lease(id)).held_qty), 3);
  await checks();
  await app.pool.query("UPDATE business_depot_journal SET lease_stock_after=2 WHERE lease_id=$1 AND reason='warehouse_deposit'", [id]);
  const tampered = await runLedgerInvariants(app.pool, { alert: false });
  assert.equal(tampered.checks.find(c => c.name === `warehouse custody sequence:${id}`).ok, false,
    'after-state tampering is detected even when total custody deltas still balance');
  await app.pool.query("UPDATE business_depot_journal SET lease_stock_after=3 WHERE lease_id=$1 AND reason='warehouse_deposit'", [id]);
  await checks();
  await kill(landlord);
  assert.equal((await lease(id)).status, 'landlord_closed');
  assert.equal(Number((await lease(id)).held_qty), 3, 'landlord estate preserves tenant cargo');
  const human = { ...tenant, token: tenant.ownerToken };
  assert.equal((await call('POST', `/v1/warehouse-leases/${id}/withdraw`, human, { qty: 3 })).code, 200, 'human and agent credentials share retrieval rights');
  assert.equal(await cargo(tenant), 4);
  assert.equal((await call('POST', `/v1/warehouse-leases/${id}/close`, tenant)).body.refunded, 0);
  await checks();

  const secondDepot = await open(other);
  const secondRent = await call('POST', `/v1/warehouses/${secondDepot}/lease`, tenant, { ...terms, units: 5, maxTotalCash: 125 });
  assert.equal(secondRent.code, 200);
  const secondId = secondRent.body.lease.id;
  if (postgres) {
    await app.pool.query("CREATE FUNCTION warehouse_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='warehouse_deposit' THEN RAISE EXCEPTION 'warehouse journal fixture failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER warehouse_fail BEFORE INSERT ON business_depot_journal FOR EACH ROW EXECUTE FUNCTION warehouse_fail()');
    assert.equal((await call('POST', `/v1/warehouse-leases/${secondId}/deposit`, tenant, { qty: 2 })).code, 500);
    assert.equal(await cargo(tenant), 4, 'journal failure rolls back trunk transfer');
    assert.equal(Number((await lease(secondId)).held_qty), 0, 'journal failure rolls back warehouse custody');
    await app.pool.query('DROP TRIGGER warehouse_fail ON business_depot_journal');
    await app.pool.query('DROP FUNCTION warehouse_fail()');
  }
  assert.equal((await call('POST', `/v1/warehouse-leases/${secondId}/deposit`, tenant, { qty: 2 })).code, 200);
  await kill(tenant);
  assert.equal((await lease(secondId)).status, 'tenant_dead');
  assert.equal(Number((await lease(secondId)).held_qty), 0, 'tenant estate scatters stored goods exactly once');
  await checks();
  if (postgres) {
    const a = await create('Competing Warehouse One'), b = await create('Competing Warehouse Two');
    const races = await Promise.all([a, b].map(p => call('POST', `/v1/warehouses/${secondDepot}/lease`, p, terms)));
    assert.equal(races.filter(r => r.code === 200).length, 1, 'last available compartment cannot be oversubscribed');
    assert.equal(races.filter(r => r.body.error === 'warehouse_capacity').length, 1);
    const winner = races[0].code === 200 ? a : b;
    const winningLease = races.find(r => r.code === 200).body.lease.id;
    assert.equal((await call('POST', `/v1/depot/${secondDepot}/fund`, other, { amount: 10000 })).code, 200);
    assert.equal((await call('POST', `/v1/depot/${secondDepot}/configure`, other,
      { salePrice: 2000, bidPrice: 123, targetStock: 40, reorderAt: 0, restockBudget: 10000 })).code, 200);
    const otherOwner = { ...other, token: other.ownerToken };
    const procurement = await call('POST', `/v1/depot/${secondDepot}/restock`, otherOwner);
    assert.equal(procurement.code, 200, JSON.stringify(procurement.body));
    assert.equal(procurement.body.wanted, 30, 'procurement preserves ten leased slots');
    const supplier = winner === a ? b : a;
    for (let i = 0; i < 3; i++) {
      assert.equal((await call('POST', '/v1/goods/buy', supplier, { goodId: 'gin', qty: 10 })).code, 200);
      assert.equal((await call('POST', `/v1/market/${procurement.body.id}/fill`, supplier, { qty: 10 })).code, 200);
    }
    assert.equal((await call('POST', `/v1/depot/${secondDepot}/orders/${procurement.body.id}/receive`, otherOwner)).code, 200,
      'merchant receipt and reserved tenant capacity coexist exactly');
    assert.equal((await call('POST', '/v1/goods/buy', winner, { goodId: 'gin', qty: 2 })).code, 200);
    assert.equal((await call('POST', `/v1/warehouse-leases/${winningLease}/deposit`, winner, { qty: 2 })).code, 200);
    await app.pool.query("UPDATE business_warehouse_leases SET created_at=now()-interval '2 days',expires_at=now()-interval '1 second' WHERE id=$1", [winningLease]);
    assert.equal((await call('POST', `/v1/warehouse-leases/${winningLease}/deposit`, winner, { qty: 1 })).body.error, 'warehouse_expired');
    assert.equal((await call('POST', `/v1/warehouse-leases/${winningLease}/withdraw`, winner, { qty: 2 })).code, 200,
      'expiry preserves physical retrieval rights');
    const aDepot = await open(a), bDepot = await open(b);
    const aRent = await call('POST', `/v1/warehouses/${bDepot}/lease`, a, { ...terms, units: 5, maxTotalCash: 125 });
    const bRent = await call('POST', `/v1/warehouses/${aDepot}/lease`, b, { ...terms, units: 5, maxTotalCash: 125 });
    assert.equal(aRent.code, 200); assert.equal(bRent.code, 200);
    for (const [p, rented] of [[a, aRent], [b, bRent]]) {
      if (await cargo(p) < 2) assert.equal((await call('POST', '/v1/goods/buy', p, { goodId: 'gin', qty: 2 })).code, 200);
      assert.equal((await call('POST', `/v1/warehouse-leases/${rented.body.lease.id}/deposit`, p, { qty: 2 })).code, 200);
    }
    await Promise.all([kill(a), kill(b)]);
    for (const rented of [aRent, bRent]) {
      assert.equal((await lease(rented.body.lease.id)).status, 'tenant_dead');
      assert.equal(Number((await lease(rented.body.lease.id)).held_qty), 0);
    }
    await checks();
  }
  console.log(`warehouse API: rent/cargo replay, private custody, human/agent parity, canonical landlord/tenant estate and invariants passed${postgres ? '; native rollback and capacity race passed' : ''}`);
} finally { await app.close(); }
