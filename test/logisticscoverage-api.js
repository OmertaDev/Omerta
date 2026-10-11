import assert from 'node:assert/strict';

process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'logistics-coverage-api-local-test-secret-only';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.MOD_KEY = 'logistics-coverage-api-local-test-mod';
process.env.DEPOT_PILOT = 'on';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const endpoint = new URL(process.env.LOGISTICS_COVERAGE_TEST_DATABASE_URL || 'http://missing');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
    && endpoint.hostname === '127.0.0.1'
    && /^\/logistics_coverage_api_[a-z0-9_]+$/.test(endpoint.pathname)
    && !endpoint.search && !endpoint.hash && !endpoint.password
    && ((endpoint.port === '35439' && endpoint.username === 'pilot_runner')
      || (endpoint.port === '5432' && endpoint.username === 'postgres')),
  'Use an explicit empty isolated local logistics_coverage_api_ PostgreSQL database.');
  const { default: pg } = await import('pg');
  const preflight = new pg.Pool({ connectionString: endpoint.href });
  try {
    const rows = await preflight.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(rows.rows.length, 0, 'Native API proof requires its own empty database');
  } finally { await preflight.end(); }
  process.env.DATABASE_URL = endpoint.href;
  process.env.MARKET_SEED = 'logistics-coverage-api-local-native-proof-seed';
}
const { buildServer } = await import('../src/server.js');
const { ledger } = await import('../src/game.js');
const app = await buildServer();
let sequence = 0;
const call = async (method, url, player, body, key = `coverage-api-${++sequence}`) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(player ? { authorization: `Bearer ${player.token}` } : {}),
      ...(key === null ? {} : { 'idempotency-key': key }) } });
  return { code: response.statusCode, body: response.json() };
};
const create = async name => {
  const ownerToken = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', { token: ownerToken })).body.token;
  const player = { token, ownerToken };
  assert.equal((await call('POST', '/v1/character', player, { name })).code, 200);
  const ch = (await call('GET', '/v1/me', player)).body.character;
  player.id = ch.id;
  await app.pool.query('UPDATE characters SET cash=50000 WHERE id=$1', [ch.id]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 50000 - ch.cash,
    reason: 'crime:coverage-api-fixture' });
  return player;
};
const cash = async player => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [player.id])).rows[0].cash);
const kill = async player => {
  const response = await app.inject({ method: 'POST', url: '/v1/mod/kill',
    payload: { characterId: player.id }, headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(response.statusCode, 200, response.body);
  const successor = (await call('GET', '/v1/me', player)).body.character;
  assert.notEqual(successor.id, player.id, 'Canonical estate creates the account successor');
  return { ...player, id: successor.id };
};
const storedLease = async (landlord, tenant, qty = 3) => {
  const opened = await call('POST', '/v1/depot', landlord,
    { salePrice: 2000, bidPrice: 123, targetStock: 4, reorderAt: 0, restockBudget: 3000 });
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  const depotId = opened.body.id;
  assert.equal((await call('POST', `/v1/depot/${depotId}/warehouse-offer`, landlord,
    { expectedRevision: 0, enabled: true, slots: 10, cashPerUnitDay: 25 })).code, 200);
  const rented = await call('POST', `/v1/warehouses/${depotId}/lease`, tenant,
    { units: 10, expectedOfferRevision: 1, maxTotalCash: 250 });
  assert.equal(rented.code, 200, JSON.stringify(rented.body));
  assert.equal((await call('POST', '/v1/goods/buy', tenant, { goodId: 'gin', qty })).code, 200);
  const leaseId = rented.body.lease.id;
  assert.equal((await call('POST', `/v1/warehouse-leases/${leaseId}/deposit`, tenant, { qty })).code, 200);
  return { leaseId, depotId };
};

const row = async id => (await app.pool.query('SELECT * FROM logistics_coverage_policies WHERE id=$1', [id])).rows[0];
const command = (id, action, player, body = {}, key) => call('POST', `/v1/logistics-coverage/${id}/${action}`, player, body, key);
const offer = async (leaseId, insurer, milliseconds = 60000, key) => {
  const body = { leaseId, coveredUnits: 3, cashPerUnit: 100, premiumCash: 25,
    expiresAt: new Date(Date.now() + milliseconds).toISOString() };
  const response = await call('POST', '/v1/logistics-coverage/offers', insurer, body, key);
  assert.equal(response.code, 200, JSON.stringify(response.body));
  return { id: response.body.policy.id, response, body };
};
const waitPast = async expiresAt => {
  const delay = Math.max(0, Date.parse(expiresAt) - Date.now() + 100);
  assert(delay < 15000, 'Proof waits only for bounded actual short expiry');
  await new Promise(resolve => setTimeout(resolve, delay));
};
try {
  assert.equal((await call('GET', '/v1/logistics-coverage')).code, 401);
  const spec = (await call('GET', '/openapi.json')).body;
  const expectedOperations = new Map([
    ['getOwnGameLogisticsCoverage', ['get', '/v1/logistics-coverage']],
    ['offerOwnGameLogisticsCoverage', ['post', '/v1/logistics-coverage/offers']],
    ['acceptOwnGameLogisticsCoverage', ['post', '/v1/logistics-coverage/{id}/accept']],
    ['cancelOwnUnfundedGameLogisticsCoverage', ['post', '/v1/logistics-coverage/{id}/cancel']],
    ['claimOwnGameLogisticsCoverage', ['post', '/v1/logistics-coverage/{id}/claim']],
    ['refundOwnGameLogisticsCoverageReserve', ['post', '/v1/logistics-coverage/{id}/refund']]]);
  const discovered = new Map();
  for (const [path, methods] of Object.entries(spec.paths)) for (const [method, operation] of Object.entries(methods)) {
    if (!expectedOperations.has(operation.operationId)) continue;
    assert(!discovered.has(operation.operationId), 'Coverage operation IDs are unique');
    assert.deepEqual([method, path], expectedOperations.get(operation.operationId));
    assert(operation.security?.length, 'Coverage operations require authenticated invocation');
    discovered.set(operation.operationId, operation);
  }
  assert.equal(discovered.size, expectedOperations.size, 'Agents discover all six closed native operations');
  const landlord = await create('Coverage Landlord'), tenant = await create('Coverage Tenant');
  const insurer = await create('Coverage Insurer'), outsider = await create('Coverage Stranger');
  const lease = await storedLease(landlord, tenant);
  const initialInsurer = await cash(insurer), initialTenant = await cash(tenant);
  const proposed = await offer(lease.leaseId, insurer, 60000, 'coverage-exact-offer');
  assert.equal(await cash(insurer), initialInsurer, 'An unaccepted offer reserves no cash');
  assert.equal(Number((await row(proposed.id)).escrow_cash), 0);
  assert.deepEqual(await call('POST', '/v1/logistics-coverage/offers', insurer, proposed.body, 'coverage-exact-offer'), proposed.response);
  const changed = await call('POST', '/v1/logistics-coverage/offers', insurer,
    { ...proposed.body, premiumCash: 24 }, 'coverage-exact-offer');
  assert(changed.code >= 400 && changed.code < 500, 'Changed replay terms reject');
  for (const field of ['beneficiaryAccountId', 'enrolledAt', 'enrollmentSequence']) {
    const forged = await call('POST', '/v1/logistics-coverage/offers', insurer,
      { ...proposed.body, [field]: field === 'enrollmentSequence' ? 99 : tenant.id });
    assert(forged.code >= 400 && forged.code < 500);
  }
  assert((await call('POST', '/v1/logistics-coverage/offers', insurer, proposed.body, null)).code >= 400);
  assert.equal((await call('GET', '/v1/logistics-coverage', outsider)).body.policies.length, 0);
  assert((await command(proposed.id, 'accept', outsider)).code >= 400);
  assert((await command(proposed.id, 'accept', tenant, { beneficiary: outsider.id })).code >= 400);
  await app.pool.query('UPDATE characters SET cash=290 WHERE id=$1', [insurer.id]);
  assert((await command(proposed.id, 'accept', tenant)).code >= 400,
    'Insurer must fund full reserve before collecting a premium that would restore solvency');
  assert.equal(Number((await row(proposed.id)).escrow_cash), 0);
  assert.equal(await cash(tenant), initialTenant);
  await app.pool.query('UPDATE characters SET cash=$2 WHERE id=$1', [insurer.id, initialInsurer]);
  const accepted = await command(proposed.id, 'accept', { ...tenant, token: tenant.ownerToken });
  assert.equal(accepted.code, 200, JSON.stringify(accepted.body));
  assert.equal(await cash(insurer), initialInsurer - 300 + 25);
  assert.equal(await cash(tenant), initialTenant - 25);
  assert.equal(Number((await row(proposed.id)).escrow_cash), 300);
  assert.equal((await command(proposed.id, 'accept', tenant)).code, 200);
  assert.equal(await cash(tenant), initialTenant - 25, 'Agent replay shares human acceptance without another premium');
  assert((await command(proposed.id, 'cancel', insurer)).code >= 400, 'Accepted premium does not authorize cancellation');
  const insurerHeir = await kill(insurer);
  const tenantHeir = await kill(tenant);
  const event = (await app.pool.query("SELECT * FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_tenant_death'", [lease.leaseId])).rows[0];
  assert(event.event_at, 'Actual canonical estate captures post-lock burn clock');
  assert(+new Date(event.event_at) >= +new Date((await row(proposed.id)).accepted_at));
  process.env.DEPOT_PILOT = 'off';
  const heirBefore = await cash(tenantHeir);
  const claimed = await command(proposed.id, 'claim', tenantHeir);
  assert.equal(claimed.code, 200, JSON.stringify(claimed.body));
  assert.equal(await cash(tenantHeir), heirBefore + 300, 'Original account successor receives actual insured burn');
  assert.equal(Number((await row(proposed.id)).escrow_cash), 0);
  assert.equal((await command(proposed.id, 'claim', tenantHeir)).code, 200);
  assert.equal(await cash(tenantHeir), heirBefore + 300);
  const nextHeir = await kill(tenantHeir), nextBefore = await cash(nextHeir);
  assert.equal((await command(proposed.id, 'claim', nextHeir)).code, 200);
  assert.equal(await cash(nextHeir), nextBefore, 'Receipt replay never pays a later successor again');
  assert.equal((await command(proposed.id, 'refund', insurerHeir)).code, 200);
  process.env.DEPOT_PILOT = 'on';

  const landlord2 = await create('Coverage Landlord Two'), tenant2 = await create('Coverage Tenant Two');
  const insurer2 = await create('Coverage Insurer Two');
  const lease2 = await storedLease(landlord2, tenant2, 3);
  const short = await offer(lease2.leaseId, insurer2, 10000);
  assert.equal((await command(short.id, 'accept', tenant2)).code, 200);
  assert.equal((await call('POST', `/v1/warehouse-leases/${lease2.leaseId}/withdraw`, tenant2, { qty: 1 })).code, 200);
  const tenant2Heir = await kill(tenant2);
  const insurer2Heir = await kill(insurer2);
  const burn2 = (await app.pool.query("SELECT id,event_at FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_tenant_death'", [lease2.leaseId])).rows[0];
  await waitPast(short.body.expiresAt);
  await app.pool.query('UPDATE business_depot_journal SET event_at=NULL WHERE id=$1', [burn2.id]);
  const beforeUnknown = await cash(insurer2Heir);
  assert((await command(short.id, 'refund', insurer2Heir)).code >= 400, 'Unknown old evidence cannot release potential owed reserve');
  assert.equal(await cash(insurer2Heir), beforeUnknown);
  assert.equal(Number((await row(short.id)).escrow_cash), 300);
  await app.pool.query('UPDATE business_depot_journal SET event_at=$2 WHERE id=$1', [burn2.id, burn2.event_at]);
  const refunded = await command(short.id, 'refund', insurer2Heir);
  assert.equal(refunded.code, 200, JSON.stringify(refunded.body));
  assert.equal(await cash(insurer2Heir), beforeUnknown + 100, 'Original insurer account successor recovers only excess reserve');
  assert.equal(Number((await row(short.id)).escrow_cash), 200, 'Expiry freezes owed benefit before refunding only excess');
  const laterInsurerHeir = await kill(insurer2Heir), laterInsurerCash = await cash(laterInsurerHeir);
  assert.equal((await command(short.id, 'refund', laterInsurerHeir)).code, 200);
  assert.equal(await cash(laterInsurerHeir), laterInsurerCash, 'A later insurer heir cannot collect excess twice');
  const beforeClaim = await cash(tenant2Heir);
  if (postgres) {
    await app.pool.query("CREATE FUNCTION coverage_api_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='coverage:claim:" + short.id + "' THEN RAISE EXCEPTION 'coverage API payment rollback'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER coverage_api_fail BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION coverage_api_fail()');
    assert.equal((await command(short.id, 'claim', tenant2Heir, {}, 'coverage-failed-claim-retry')).code, 500);
    assert.equal(await cash(tenant2Heir), beforeClaim);
    assert.equal(Number((await row(short.id)).escrow_cash), 200);
    assert.equal((await row(short.id)).receipt, null);
    await app.pool.query('DROP TRIGGER coverage_api_fail ON transactions');
    await app.pool.query('DROP FUNCTION coverage_api_fail()');
  }
  assert.equal((await command(short.id, 'claim', tenant2Heir, {}, 'coverage-failed-claim-retry')).code, 200);
  assert.equal(await cash(tenant2Heir), beforeClaim + 200);

  const landlord3 = await create('Coverage Landlord Three'), tenant3 = await create('Coverage Tenant Three');
  const insurer3 = await create('Coverage Insurer Three');
  const lease3 = await storedLease(landlord3, tenant3);
  const unaccepted = await offer(lease3.leaseId, insurer3);
  const insurer3Heir = await kill(insurer3), cash3 = await cash(insurer3Heir);
  assert((await command(unaccepted.id, 'accept', tenant3)).code >= 400,
    'An old insurer offer cannot debit a successor who never offered those terms');
  assert.equal(await cash(insurer3Heir), cash3);
  assert.equal(Number((await row(unaccepted.id)).escrow_cash), 0);
  assert.equal((await command(unaccepted.id, 'cancel', insurer3Heir)).code, 200);
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const coverageCheck = async () => {
    const sweep = await runLedgerInvariants(app.pool, { alert: false });
    const check = sweep.checks.find(check => check.name === 'logistics coverage escrow');
    assert(check, 'Actual invariant sweep includes coverage accounting');
    return check;
  };
  if (!(await coverageCheck()).ok) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(new URL('../output/coverage-api-accounting-diagnostic.json', import.meta.url), JSON.stringify({
      policies: (await app.pool.query('SELECT * FROM logistics_coverage_policies')).rows,
      transactions: (await app.pool.query("SELECT t.*,c.account_id FROM transactions t LEFT JOIN characters c ON c.id=t.character_id WHERE t.reason LIKE 'coverage:%'")).rows,
      leases: (await app.pool.query('SELECT * FROM business_warehouse_leases')).rows,
      events: (await app.pool.query("SELECT * FROM business_depot_journal WHERE reason='warehouse_tenant_death'")).rows }, null, 2));
  }
  assert.equal((await coverageCheck()).ok, true);
  const original = (await row(proposed.id)).offer;
  for (const changed of [{ ...original, leaseId: lease2.leaseId },
    { ...original, premiumCash: 24 }, { ...original, expiresAt: new Date(Date.parse(original.expiresAt) + 1).toISOString() }, null]) {
    await app.pool.query('UPDATE logistics_coverage_policies SET offer=$2 WHERE id=$1', [proposed.id, changed === null ? 'null' : changed]);
    assert.equal((await coverageCheck()).ok, false, 'Signed offer drift or malformed data fails actual reconciliation');
    await app.pool.query('UPDATE logistics_coverage_policies SET offer=$2 WHERE id=$1', [proposed.id, original]);
    assert.equal((await coverageCheck()).ok, true);
  }
  console.log(`logistics coverage API ${postgres ? 'PostgreSQL' : 'memory'} tests passed`);
} finally { process.env.DEPOT_PILOT = 'on'; await app.close(); }
