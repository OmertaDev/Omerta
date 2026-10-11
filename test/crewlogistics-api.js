import assert from 'node:assert/strict';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.CREW_LOGISTICS_TEST_DATABASE_URL || 'http://missing');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !/^\/crew_logistics_[A-Za-z0-9_]+$/.test(url.pathname)) throw new Error('Use an isolated local crew_logistics_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
} else if (process.env.DATABASE_URL) throw new Error('Memory proof refuses an existing DATABASE_URL.');
process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'crew-logistics-api-local-secret'; process.env.MOD_KEY = 'crew-logistics-api-local-mod';
process.env.MARKET_SEED = 'crew-logistics-api-local-seed'; process.env.DEPOT_PILOT = 'on'; process.env.SOCIAL_VERIFY_MODE = 'off';
const { buildServer } = await import('../src/server.js');
const app = await buildServer();
let sequence = 0;
const call = async (method, url, token, body, key = `crew-logistics-api-${++sequence}`) => {
  const response = await app.inject({ method, url, payload: body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: response.statusCode, body: response.json() };
};
async function player(name, agentEnabled = false) {
  const owner = (await call('POST', '/v1/auth/guest')).body.token;
  assert.equal((await call('POST', '/v1/character', owner, { name })).code, 200);
  const accountId = JSON.parse(Buffer.from(owner.split('.')[1], 'base64url').toString()).sub;
  const ch = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0];
  await app.pool.query('UPDATE characters SET respect=100000,cash=100000 WHERE id=$1', [ch.id]);
  const agent = agentEnabled ? (await call('POST', '/v1/auth/agent-key', owner)).body.token : null;
  return { owner, agent, accountId, id: ch.id, name };
}
try {
  const boss = await player('API Crew Human Boss'), member = await player('API Crew Agent Member', true), outsider = await player('API Crew Outsider');
  const body = { kind: 'warehouse_claim', targetId: 'api-warehouse-consent-claim' };
  for (const [method, path, payload] of [['GET', '/v1/crew/logistics'], ['POST', '/v1/crew/logistics-links', body], ['POST', '/v1/crew/logistics-links/unknown/revoke', {}]]) assert.equal((await call(method, path, undefined, payload)).code, 401);
  assert.equal((await call('GET', '/v1/crew/logistics', outsider.owner)).body.error, 'no_crew');
  assert.equal((await call('POST', '/v1/crew/logistics-links', outsider.owner, body)).body.error, 'no_crew');
  const created = await call('POST', '/v1/crew', boss.owner, { name: 'API Mixed Logistics Crew' }); assert.equal(created.code, 200);
  const crewId = created.body.id;
  const join = async () => {
    assert.equal((await call('POST', '/v1/crew/invite', boss.owner, { name: member.name })).code, 200);
    assert.equal((await call('POST', `/v1/crew/accept/${crewId}`, member.agent, {})).code, 200);
  };
  await join();
  const depot = await call('POST', '/v1/depot', boss.owner, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }); assert.equal(depot.code, 200);
  const depotId = depot.body.id, createdAt = new Date(), expiresAt = new Date(createdAt.getTime() + 86400000);
  await app.pool.query("INSERT INTO business_warehouse_leases(id,depot_id,landlord_character,tenant_character,good_id,units,held_qty,cash_per_unit_day,fee_cash,offer_revision,created_at,expires_at,status) VALUES($1,$2,$3,$4,'gin',10,7,1,10,1,$5,$6,'active')", [body.targetId, depotId, boss.id, member.id, createdAt, expiresAt]);
  const district = (await app.pool.query('SELECT district FROM business_depots WHERE id=$1', [depotId])).rows[0].district;
  await app.pool.query("INSERT INTO delivery_commitments(id,order_id,depot_id,buyer_character,supplier_character,good_id,district,unit_price,take_bps,quantity,remaining,spend_limit,spent,status,deadline) VALUES('api-human-delivery','fixture-order',$1,$2,$3,'gin',$4,50,0,10,3,500,300,'accepted',$5)", [depotId, outsider.id, boss.id, district, expiresAt]);
  assert.equal((await call('POST', '/v1/crew/logistics-links', boss.owner, body)).body.error, 'crew_logistics', 'Crew boss cannot publish another member cargo claim');
  for (const extra of [{ heldQty: 7 }, { publisherAccountId: boss.accountId }, { task: 'withdraw', cash: 1 }]) {
    const invalid = await call('POST', '/v1/crew/logistics-links', member.agent, { ...body, ...extra }); assert.equal(invalid.code, 400); assert.equal(invalid.body.error, 'crew_logistics');
  }
  const key = 'crew-api-agent-consent';
  const shared = await call('POST', '/v1/crew/logistics-links', member.agent, body, key); assert.equal(shared.code, 200, JSON.stringify(shared.body));
  assert.deepEqual(await call('POST', '/v1/crew/logistics-links', member.agent, body, key), shared, 'exact authenticated retry does not duplicate or extend consent');
  const humanSame = await call('POST', '/v1/crew/logistics-links', member.owner, body); assert.equal(humanSame.code, 200); assert.equal(humanSame.body.link.id, shared.body.link.id); assert.equal(humanSame.body.link.expiresAt, shared.body.link.expiresAt);
  const humanLink = await call('POST', '/v1/crew/logistics-links', boss.owner, { kind: 'delivery_commitment', targetId: 'api-human-delivery' }); assert.equal(humanLink.code, 200);
  assert.equal((await call('POST', `/v1/crew/logistics-links/${humanLink.body.link.id}/revoke`, member.agent, {})).body.error, 'crew_logistics', 'member cannot remove another member consent');
  const board = await call('GET', '/v1/crew/logistics', boss.owner); assert.equal(board.code, 200); assert.equal(board.body.links.length, 2);
  assert.deepEqual(Object.keys(board.body).sort(), ['crewId','links','limit','sharedExecutionAuthority','causalEffect'].sort());
  assert.equal(board.body.sharedExecutionAuthority, false); assert.equal(board.body.causalEffect, null);
  assert.deepEqual((await call('GET', '/v1/crew/logistics', member.agent)).body, board.body, 'human and agent members receive the same consent board');
  for (const link of board.body.links) {
    assert.deepEqual(Object.keys(link).sort(), ['id','publisher','source','createdAt','expiresAt'].sort());
    const fields = ['kind','targetId','good','district','status','deadline']; if (link.source.kind === 'delivery_commitment') fields.push('quantityDelivered');
    assert.deepEqual(Object.keys(link.source).sort(), fields.sort(), 'private projection has an exact bounded field allowlist');
  }
  for (const forbidden of [boss.accountId, member.accountId, 'heldQty', 'held_qty', 'spendLimit', 'spend_limit', 'treasury', 'provider', 'feeCash', 'warehouseUnits']) assert(!JSON.stringify(board.body).includes(forbidden));
  assert.equal(new Date(shared.body.link.expiresAt) - new Date(shared.body.link.createdAt), 86400000);
  const foreignCrew = await call('POST', '/v1/crew', outsider.owner, { name: 'API Isolated Other Crew' }); assert.equal(foreignCrew.code, 200);
  assert.deepEqual((await call('GET', '/v1/crew/logistics', outsider.owner)).body.links, []);
  assert.equal((await call('POST', `/v1/crew/logistics-links/${shared.body.link.id}/revoke`, outsider.owner, {})).body.error, 'crew_logistics');
  // Stale accrual state plus every financial/custody table relevant to the displayed claim stays untouched by GET.
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [boss.id, new Date(Date.now() - 7200000)]);
  const readSnapshot = async () => ({ character: (await app.pool.query('SELECT * FROM characters WHERE id=$1', [boss.id])).rows[0],
    persistent: (await app.pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [boss.accountId])).rows[0],
    ledgerCount: (await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n,
    leases: (await app.pool.query('SELECT * FROM business_warehouse_leases ORDER BY id')).rows,
    delivery: (await app.pool.query('SELECT * FROM delivery_commitments ORDER BY id')).rows,
    depots: (await app.pool.query('SELECT * FROM business_depots ORDER BY id')).rows });
  const beforeGet = await readSnapshot(); assert.equal((await call('GET', '/v1/crew/logistics', boss.owner)).code, 200); assert.deepEqual(await readSnapshot(), beforeGet);
  const nativeClaim = async () => ({ lease: (await app.pool.query('SELECT * FROM business_warehouse_leases WHERE id=$1', [body.targetId])).rows[0],
    cargo: (await app.pool.query('SELECT * FROM character_cargo ORDER BY character_id,good_id')).rows,
    depots: (await app.pool.query('SELECT id,treasury,stock,stock_cost FROM business_depots ORDER BY id')).rows });
  const beforeRevoke = await nativeClaim();
  const revokeKey = 'crew-api-boss-display-revoke';
  const revoked = await call('POST', `/v1/crew/logistics-links/${shared.body.link.id}/revoke`, boss.owner, {}, revokeKey); assert.equal(revoked.code, 200);
  assert.deepEqual(await call('POST', `/v1/crew/logistics-links/${shared.body.link.id}/revoke`, boss.owner, {}, revokeKey), revoked);
  assert.deepEqual(await nativeClaim(), beforeRevoke, 'boss revokes display only; contract/cargo/treasury authority unchanged');
  const unauthorizedWithdraw = await call('POST', `/v1/warehouse-leases/${body.targetId}/withdraw`, boss.owner, { qty: 1 }); assert.equal(unauthorizedWithdraw.body.error, 'not_yours');
  assert.deepEqual(await nativeClaim(), beforeRevoke, 'Crew display access never permits executing another tenant obligation');
  const renewed = await call('POST', '/v1/crew/logistics-links', member.agent, body); assert.equal(renewed.code, 200); assert.notEqual(renewed.body.link.id, shared.body.link.id);
  assert.equal((await call('POST', '/v1/crew/leave', member.agent, {})).code, 200);
  assert((await app.pool.query('SELECT revoked_at FROM crew_logistics_links WHERE id=$1', [renewed.body.link.id])).rows[0].revoked_at);
  assert.equal((await call('GET', '/v1/crew/logistics', member.agent)).body.error, 'no_crew');
  await join();
  const rejoined = await call('GET', '/v1/crew/logistics', member.agent); assert.equal(rejoined.code, 200); assert.equal(rejoined.body.links.length, 1); assert.equal(rejoined.body.links[0].id, humanLink.body.link.id, 'rejoining never revives old member consent');
  assert.deepEqual(await nativeClaim(), beforeRevoke);
  const ownFinal = await call('POST', '/v1/crew/logistics-links', member.owner, body); assert.equal(ownFinal.code, 200);
  assert.equal((await call('POST', `/v1/crew/logistics-links/${ownFinal.body.link.id}/revoke`, member.agent, {})).code, 200, 'agent may revoke only its own display consent');
  console.log(`Crew logistics API ${postgres ? 'PostgreSQL' : 'memory'} PASS: authenticated human/agent parity, own-source and cross-Crew privacy, exact field allowlists/retries, no-accrual GET, irreversible leave/rejoin revocation, boss display-only removal with native obligation rejection`);
} finally { await app.close(); }
