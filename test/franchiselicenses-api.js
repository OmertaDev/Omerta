import assert from 'node:assert/strict';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.FRANCHISE_TEST_DATABASE_URL || 'http://missing');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !/^\/franchise_[A-Za-z0-9_]+$/.test(url.pathname)) throw new Error('Use an isolated local franchise_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
} else if (process.env.DATABASE_URL) throw new Error('Memory proof refuses an existing DATABASE_URL.');
process.env.DEPOT_PILOT = 'on'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'franchise-api-local-test-secret'; process.env.MOD_KEY = 'franchise-api-local-test-mod'; process.env.MARKET_SEED = 'franchise-api-local-test-seed';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js');
const { bookDepot } = await import('../src/depotbook.js');
const { prepareFranchiseSale, settleFranchiseSale } = await import('../src/franchiselicenses.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer();
let sequence = 0;
const call = async (method, url, token, body, key = `franchise-api-${++sequence}`) => {
  const response = await app.inject({ method, url, payload: body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key } });
  return { code: response.statusCode, body: response.json() };
};
async function player(name, withAgent = false) {
  const owner = (await call('POST', '/v1/auth/guest')).body.token;
  assert.equal((await call('POST', '/v1/character', owner, { name })).code, 200);
  const accountId = JSON.parse(Buffer.from(owner.split('.')[1], 'base64url').toString()).sub;
  const ch = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0];
  await app.pool.query('UPDATE characters SET cash=1000000 WHERE id=$1', [ch.id]);
  const agent = withAgent ? (await call('POST', '/v1/auth/agent-key', owner)).body.token : null;
  return { owner, agent, accountId, id: ch.id };
}
const config = { salePrice: 101, bidPrice: 50, targetStock: 40, reorderAt: 0, restockBudget: 5000 };
const policy = { expectedRevision: 0, enabled: true, allowRestock: false, allowReceive: false, businessPriority: false, maxSpend: 0, reserveCash: 1000, expiresInSeconds: 3600 };
try {
  const licensor = await player('API Human Brand'), operator = await player('API Agent Operator', true), buyer = await player('API Agent Buyer', true), stranger = await player('API Franchise Stranger');
  const recipientDepot = (await call('POST', '/v1/depot', licensor.owner, config)).body.id;
  const operatorDepot = (await call('POST', '/v1/depot', operator.owner, config)).body.id;
  assert(recipientDepot && operatorDepot);
  const company = await call('POST', '/v1/resources/company', licensor.owner, { expectedRevision: 0, name: 'API Native Brand', published: true, premises: null });
  assert.equal(company.code, 200, JSON.stringify(company.body));
  await G.withCharacter(app.pool, operator.accountId, async (ch, client) => {
    const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [operatorDepot])).rows[0];
    await bookDepot(client, depot, 'fixture_stock', { stock: 20, cost: 1000 });
  });
  const row = (await app.pool.query('SELECT district FROM business_depots WHERE id=$1', [operatorDepot])).rows[0];
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [buyer.id, row.district]);
  const terms = { operatorDepotId: operatorDepot, companyRevision: 1, presetId: 'gin_storefront', royaltyBps: 1000, royaltyCap: 1000000, expiresAt: new Date(Date.now() + 86400000).toISOString() };
  const offerUrl = `/v1/depot/${recipientDepot}/franchise-offers`;
  assert.equal((await call('GET', '/v1/franchise-licenses')).code, 401);
  assert.equal((await call('POST', offerUrl, undefined, terms)).code, 401);

  const offerKey = 'franchise-offer-exact';
  const offered = await call('POST', offerUrl, licensor.owner, terms, offerKey);
  assert.equal(offered.code, 200, `valid route offer must separate operatorDepotId from strict licence terms: ${JSON.stringify(offered.body)}`);
  assert.equal(offered.body.license.status, 'offered');
  assert.equal((await call('POST', offerUrl, stranger.owner, terms)).body.error, 'franchise_owner');
  assert.equal((await call('POST', offerUrl, licensor.owner, { ...terms, operatorDepotId: recipientDepot })).body.error, 'self');
  assert.equal((await call('POST', offerUrl, licensor.owner, { ...terms, companyRevision: 2 })).body.error, 'franchise_company');
  assert.deepEqual(await call('POST', offerUrl, licensor.owner, terms, offerKey), offered, 'exact offer retry never duplicates consent');
  const id = offered.body.license.id;
  const journals = async () => (await app.pool.query('SELECT * FROM business_depot_journal ORDER BY id')).rows;
  const snapshot = async () => ({ depots: (await app.pool.query('SELECT id,treasury,stock,stock_cost FROM business_depots ORDER BY id')).rows,
    license: (await app.pool.query('SELECT paid,earned_net,status FROM depot_brand_licenses WHERE id=$1', [id])).rows[0],
    cargo: (await app.pool.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id', [buyer.id])).rows,
    cash: (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [buyer.id])).rows[0], journal: await journals() });
  const buy = (key = `franchise-buy-${++sequence}`) => call('POST', `/v1/depot/${operatorDepot}/buy`, buyer.agent, { qty: 1, maxUnitPrice: 101 }, key);
  assert.equal((await buy()).code, 200);
  assert.equal((await journals()).filter(j => j.reason === 'royalty_income').length, 0, 'licensor offer alone never charges royalties');
  assert.equal((await call('POST', `/v1/franchise-licenses/${id}/accept`, stranger.owner, {})).body.error, 'franchise_owner');
  assert.equal((await call('POST', `/v1/franchise-licenses/${id}/accept`, licensor.owner, {})).body.error, 'self');
  assert.equal((await call('POST', `/v1/depot/${operatorDepot}/policy`, operator.owner, policy)).code, 200);
  assert.equal((await call('POST', `/v1/franchise-licenses/${id}/accept`, operator.agent, {})).body.error, 'owner_authority', 'agent cannot expand delegated operating authority');
  const accepted = await call('POST', `/v1/franchise-licenses/${id}/accept`, operator.owner, {}, 'franchise-accept-exact');
  assert.equal(accepted.code, 200, JSON.stringify(accepted.body)); assert.equal(accepted.body.license.status, 'active');
  assert.deepEqual(await call('POST', `/v1/franchise-licenses/${id}/accept`, operator.owner, {}, 'franchise-accept-exact'), accepted);
  const privateBoard = await call('GET', '/v1/franchise-licenses', operator.agent);
  assert.equal(privateBoard.code, 200); assert.equal(privateBoard.body.licenses.length, 1);
  assert(!JSON.stringify(privateBoard.body.licenses).includes(licensor.accountId)); assert(!JSON.stringify(privateBoard.body.licenses).includes('provider'));
  assert.deepEqual((await call('GET', '/v1/franchise-licenses', stranger.owner)).body.licenses, []);
  const opBefore = (await call('GET', '/v1/depot', operator.owner)).body.depot;
  const brandBefore = (await call('GET', '/v1/depot', licensor.owner)).body.depot;
  const purchase = await buy('franchise-buy-exact'); assert.equal(purchase.code, 200, JSON.stringify(purchase.body));
  const afterPurchase = await snapshot(); assert.deepEqual(await buy('franchise-buy-exact'), purchase); assert.deepEqual(await snapshot(), afterPurchase, 'exact HTTP purchase retry cannot duplicate cash/cargo/sale/royalty');
  const royalties = (await journals()).filter(j => j.franchise_license_id === id);
  const credit = royalties.find(j => j.reason === 'royalty_income'), debit = royalties.find(j => j.reason === 'royalty_expense');
  assert(credit && debit, 'canonical API buy must itself create both royalty entries; no test settlement funds it');
  const expected = Math.floor(purchase.body.businessRevenue / 10);
  assert.equal(Number(credit.cash_delta), expected); assert.equal(Number(debit.cash_delta), -expected); assert.equal(credit.source_journal_id, debit.source_journal_id);
  const sourceSale = (await journals()).find(j => j.id === credit.source_journal_id);
  assert.equal(sourceSale.reason, 'sale'); assert.equal(sourceSale.customer_character, buyer.id); assert.equal(Number(sourceSale.cash_delta), purchase.body.businessRevenue);
  const opAfter = (await call('GET', '/v1/depot', operator.owner)).body.depot;
  const brandAfter = (await call('GET', '/v1/depot', licensor.owner)).body.depot;
  assert.equal(brandAfter.royaltyRevenue - brandBefore.royaltyRevenue, expected); assert.equal(brandAfter.operatingProfit - brandBefore.operatingProfit, expected, 'recipient income counted once');
  assert.equal(opAfter.customerRevenue - opBefore.customerRevenue, purchase.body.businessRevenue);
  assert.equal(opAfter.operatingExpenses - opBefore.operatingExpenses, expected);
  assert.equal(opAfter.operatingProfit - opBefore.operatingProfit, purchase.body.businessRevenue - 50 - expected, 'operator royalty expense counted once');
  const franchiseChecks = async client => (await runLedgerInvariants(client, { alert: false })).checks.filter(c => c.name.startsWith('franchise '));
  assert.deepEqual((await franchiseChecks(app.pool)).filter(c => !c.ok), []);
  // Missing canonical sale proof cannot authorize a royalty transfer.
  const beforeMissing = await snapshot();
  await assert.rejects(G.withTwoCharacters(app.pool, buyer.accountId, operator.id, async (_ch, _owner, client) => {
    const prepared = await prepareFranchiseSale(client, operatorDepot);
    await settleFranchiseSale(client, prepared.context, 'nonexistent-native-sale');
  }), e => e.code === 'franchise_proof');
  assert.deepEqual(await snapshot(), beforeMissing);
  if (postgres) {
    // Causal negative: removing the income edge makes conserved/provenance checks fail, then restore the exact original row in this disposable database.
    await app.pool.query('DELETE FROM business_depot_journal WHERE id=$1', [credit.id]);
    try { assert((await franchiseChecks(app.pool)).some(c => !c.ok && c.name === 'franchise royalty conservation')); }
    finally {
      const columns = Object.keys(credit); assert(columns.every(column => /^[a-z_]+$/.test(column)));
      await app.pool.query(`INSERT INTO business_depot_journal(${columns.join(',')}) VALUES(${columns.map((_, i) => `$${i + 1}`).join(',')})`, columns.map(column => credit[column]));
    }
    assert.deepEqual((await franchiseChecks(app.pool)).filter(c => !c.ok), []);
    const beforeFailure = await snapshot();
    await app.pool.query("CREATE FUNCTION franchise_api_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='royalty_income' THEN RAISE EXCEPTION 'franchise_api_injected_journal_failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER franchise_api_fail BEFORE INSERT ON business_depot_journal FOR EACH ROW EXECUTE FUNCTION franchise_api_fail()');
    try { const failed = await buy('franchise-buy-failure'); assert.equal(failed.code, 500); }
    finally { await app.pool.query('DROP TRIGGER franchise_api_fail ON business_depot_journal'); await app.pool.query('DROP FUNCTION franchise_api_fail()'); }
    assert.deepEqual(await snapshot(), beforeFailure, 'native HTTP royalty journal failure rolls back buyer cash/cargo, stock/COGS, paired treasuries/counters/journals');
    assert.equal((await buy('franchise-buy-failure')).code, 200, 'same failed key may safely execute after rollback');
  }
  assert.equal((await call('POST', `/v1/franchise-licenses/${id}/end`, operator.agent, {})).body.error, 'owner_authority');
  assert.equal((await call('POST', `/v1/franchise-licenses/${id}/end`, stranger.owner, {})).body.error, 'franchise_owner');
  const ended = await call('POST', `/v1/franchise-licenses/${id}/end`, licensor.owner, {}, 'franchise-end-exact'); assert.equal(ended.code, 200);
  assert.deepEqual(await call('POST', `/v1/franchise-licenses/${id}/end`, licensor.owner, {}, 'franchise-end-exact'), ended);
  const royaltyCount = (await journals()).filter(j => j.reason === 'royalty_income').length;
  assert.equal((await buy()).code, 200); assert.equal((await journals()).filter(j => j.reason === 'royalty_income').length, royaltyCount, 'ending prevents further royalty');
  // New living character identity cannot inherit a predecessor's private licence board.
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [operator.id]);
  const heir = await call('POST', '/v1/character', operator.owner, { name: 'API Franchise Heir' }); assert.equal(heir.code, 200, JSON.stringify(heir.body));
  const heirBoard = await call('GET', '/v1/franchise-licenses', operator.owner); assert.equal(heirBoard.code, 200); assert.deepEqual(heirBoard.body.licenses, []);
  console.log(`franchise API ${postgres ? 'PostgreSQL' : 'memory'} PASS: human/agent auth, foreign/private scope, both consents, owner policy, exact retries, native retail royalty, missing proof, income/profit once, ending and heir privacy${postgres ? '; native missing-edge negative and injected journal rollback' : ''}`);
} finally { await app.close(); }
