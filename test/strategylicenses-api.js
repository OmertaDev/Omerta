import assert from 'node:assert/strict';
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.STRATEGY_LICENSE_API_TEST_DATABASE_URL || 'http://missing');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1');
  assert((url.port === '35439' && url.username === 'pilot_runner' && url.password === '')
    || (url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck'));
  assert(/^\/strategy_license_api_[a-z0-9_]+$/.test(url.pathname));
  assert(!url.search && !url.hash);
  const { default: pg } = await import('pg');
  const preflight = new pg.Pool({ connectionString: url.href });
  try { assert.equal((await preflight.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'Native API proof requires its own empty database'); }
  finally { await preflight.end(); }
  process.env.DATABASE_URL = url.href; process.env.MARKET_SEED = 'strategy-license-api-local-fixture';
} else assert(!process.env.DATABASE_URL, 'Memory proof refuses ambient DATABASE_URL');
process.env.DEPOT_PILOT = 'on'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'strategy-license-api-module-local-test-secret'; process.env.MOD_KEY = 'strategy-license-api-local-test-mod-secret';
const { buildServer } = await import('../src/server.js');
const { DISTRICTS, priceBlock } = await import('../src/rules.js');
const { INTEL_FORECAST } = await import('../src/intelforecasts.js');
const { strategyLicenseFaults } = await import('../src/strategylicenseinvariants.js');
const app = await buildServer(); let serial = 0;
const discovery = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();
for (const path of ['/v1/strategies', '/v1/strategies/{id}/buy']) {
  assert(discovery.paths[path].post.parameters.some(p => p.name === 'Idempotency-Key' && p.in === 'header' && p.required), 'Machine clients discover the durable replay identity');
}
async function call(method, url, who = null, body = undefined, key = `strategy-api-${++serial}`) {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(who ? { authorization: `Bearer ${who.token}` } : {}), 'idempotency-key': key } });
  return { code: response.statusCode, body: response.json(), headers: response.headers };
}
const success = response => { assert.equal(response.code, 200, JSON.stringify(response.body)); return response.body; };
async function player(agent) {
  const guest = success(await call('POST', '/v1/auth/guest'));
  const who = { token: guest.token, account: JSON.parse(Buffer.from(guest.token.split('.')[1], 'base64url').toString()).sub };
  if (agent) {
    who.token = success(await call('POST', '/v1/auth/agent-key', who)).token;
    assert.equal(JSON.parse(Buffer.from(who.token.split('.')[1], 'base64url').toString()).agent, true);
  }
  success(await call('POST', '/v1/character', who, { name: `Strategy API ${++serial}` }));
  who.id = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [who.account])).rows[0].id;
  await app.pool.query('UPDATE characters SET cash=50000.5,last_accrued_at=$2 WHERE id=$1', [who.id, new Date(Date.now() + 3600000)]);
  return who;
}
const cash = async who => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [who.id])).rows[0].cash);
const body = { title: 'Finite public gin forecast', rule: { kind: 'gin_availability_v1', districtId: DISTRICTS[0].id, minimumStock: 3, triggerStock: 7 }, feeCash: 125 };
const buy = (who, version, key, payload = {}) => call('POST', `/v1/strategies/${version}/buy`, who, payload, key);
function publicOnly(entry) {
  for (const key of ['rule', 'ruleHash', 'observation', 'predictsAvailable', 'reportedAt', 'sample', 'sampleStartedAt'])
    assert(!Object.hasOwn(entry, key), `Catalog must not leak private ${key}`);
  // STRAT-01: the finite private rule was recoverable from an unsalted public hash.
  // Publishing the hash is a disclosure even when raw rule fields are omitted.
  assert.equal(entry.profitVerified, false); assert.equal(entry.causalImprovementVerified, false);
}
try {
  for (const [method, url, payload] of [['GET', '/v1/strategies/library'], ['POST', '/v1/strategies', body],
    ['POST', '/v1/strategies/missing/buy', {}], ['POST', '/v1/strategies/missing/resolve', {}]])
    assert.equal((await call(method, url, null, payload)).code, 401);
  assert.deepEqual(success(await call('GET', '/v1/strategies')).strategies, []);
  const humanSeller = await player(false), agentSeller = await player(true), humanBuyer = await player(false), agentBuyer = await player(true), outsider = await player(false);
  for (const seller of [humanSeller, agentSeller]) for (const malformed of [
    { ...body, targetAt: new Date().toISOString() }, { ...body, outcome: 'correct' }, { ...body, observation: {} },
    { ...body, feeCash: 49 }, { ...body, feeCash: '125' }, { ...body, rule: { ...body.rule, execute: 'spend' } },
    { ...body, rule: { ...body.rule, triggerStock: '7' } }, { ...body, rule: { ...body.rule, districtId: 'private' } },
  ]) assert.notEqual((await call('POST', '/v1/strategies', seller, malformed)).code, 200);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS n FROM strategy_versions')).rows[0].n), 0);
  const deadline = Date.now() + 310100;
  while (priceBlock(Date.now() + 310000) !== priceBlock(Date.now())) {
    const now = Date.now(), until = (priceBlock(now) + 1) * INTEL_FORECAST.blockMs - now;
    assert(now < deadline && until > 0 && until <= 310000, 'Bounded real publication window readiness');
    console.log(JSON.stringify({ waitingForRealBlock: true, remainingMs: until }));
    await new Promise(resolve => setTimeout(resolve, Math.min(10000, until + 5)));
  }
  const humanPublished = success(await call('POST', '/v1/strategies', humanSeller, body, 'human-publish'));
  const agentPublished = success(await call('POST', '/v1/strategies', agentSeller, { ...body, title: 'Agent finite forecast' }, 'agent-publish'));
  for (const published of [humanPublished, agentPublished]) {
    assert.deepEqual(published.strategy.rule, body.rule); assert.equal(published.strategy.ruleHash.length, 64);
    assert.equal(Date.parse(published.strategy.targetAt) - Date.parse(published.strategy.reportedAt), 300000);
  }
  const h = humanPublished.strategy.id, a = agentPublished.strategy.id;
  const publishedReplay = await call('POST', '/v1/strategies', humanSeller, body, 'human-publish');
  assert.equal(publishedReplay.headers['x-idempotent-replay'], 'true'); assert.deepEqual(success(publishedReplay), humanPublished);
  const catalog = success(await call('GET', '/v1/strategies')).strategies;
  assert.equal(catalog.length, 2); catalog.forEach(publicOnly);
  for (const hash of [humanPublished.strategy.ruleHash, agentPublished.strategy.ruleHash])
    assert(!JSON.stringify(catalog).includes(hash), 'STRAT-01: no public alias may expose the finite private hash');
  assert.deepEqual(success(await call('GET', '/v1/strategies/library', outsider)).strategies, []);
  assert.deepEqual(success(await call('GET', `/v1/strategies/library?accountId=${humanSeller.account}`, outsider)).strategies, []);
  const denied = await call('POST', `/v1/strategies/${h}/resolve`, outsider, {});
  assert.notEqual(denied.code, 200); assert(!Object.hasOwn(denied.body, 'strategy'));
  for (const payer of [humanBuyer, agentBuyer]) for (const fields of [{ buyerAccountId: humanSeller.account }, { feeCash: 0 }, { sellerCharacterId: outsider.id }])
    assert.notEqual((await buy(payer, h, 'forged-buy', fields)).code, 200);
  const before = [await cash(agentBuyer), await cash(humanSeller), await cash(humanBuyer), await cash(agentSeller)];
  const submissions = native ? await Promise.all([buy(agentBuyer, h, 'agent-license'), buy(agentBuyer, h, 'agent-license')])
    : [await buy(agentBuyer, h, 'agent-license')];
  const completed = submissions.filter(r => r.code === 200);
  assert(completed.length >= 1);
  for (const pending of submissions.filter(r => r.code !== 200)) {
    assert.equal(pending.code, 409); assert.equal(pending.body.error, 'in_progress');
  }
  const first = [success(completed[0])], purchaseReplay = await buy(agentBuyer, h, 'agent-license');
  assert.equal(purchaseReplay.headers['x-idempotent-replay'], 'true');
  assert.equal(success(purchaseReplay).license.id, first[0].license.id);
  for (const response of completed) assert.equal(response.body.license.id, first[0].license.id);
  const second = success(await buy(humanBuyer, a, 'human-license'));
  assert.deepEqual([await cash(agentBuyer), await cash(humanSeller), await cash(humanBuyer), await cash(agentSeller)], [before[0] - 125, before[1] + 125, before[2] - 125, before[3] + 125]);
  for (const license of [first[0].license, second.license]) {
    const receipts = (await app.pool.query('SELECT amount,currency FROM transactions WHERE reason=$1 OR reason=$2', [`strategy:buy:${license.id}`, `strategy:sell:${license.id}`])).rows;
    assert.equal(receipts.length, 2); assert(receipts.every(r => r.currency === 'cash'));
    assert.equal(receipts.reduce((sum, r) => sum + Number(r.amount), 0), 0);
  }
  for (const buyer of [humanBuyer, agentBuyer]) {
    const owned = success(await call('GET', '/v1/strategies/library', buyer)).strategies;
    assert.equal(owned.length, 1); assert.deepEqual(owned[0].rule, body.rule); assert(owned[0].observation);
  }
  await app.pool.query('UPDATE characters SET cash=124.5 WHERE id=$1', [outsider.id]);
  const stolenReplay = await buy(outsider, h, 'agent-license'); assert.notEqual(stolenReplay.code, 200); assert(!stolenReplay.body.strategy);
  assert.deepEqual(success(await call('GET', '/v1/strategies/library', outsider)).strategies, []);
  assert.notEqual((await buy(agentBuyer, h, 'unbound-alias')).code, 200);
  const pending = success(await call('POST', `/v1/strategies/${h}/resolve`, agentBuyer, {}));
  assert(pending.pending); assert.deepEqual(pending.strategy.rule, body.rule);
  assert.equal(await strategyLicenseFaults(app.pool), 0, 'Actual accounting consumer accepts canonical HTTP receipts and frozen rules');
  await app.pool.query('UPDATE strategy_versions SET rule_hash=$2 WHERE id=$1', [h, '0'.repeat(64)]);
  assert(await strategyLicenseFaults(app.pool) > 0, 'Actual consumer detects a substituted rule hash');
  await app.pool.query('UPDATE strategy_versions SET rule_hash=$2 WHERE id=$1', [h, humanPublished.strategy.ruleHash]);
  await app.pool.query('UPDATE transactions SET amount=126 WHERE reason=$1', [`strategy:sell:${first[0].license.id}`]);
  assert(await strategyLicenseFaults(app.pool) > 0, 'Actual consumer detects unequal paired cash');
  await app.pool.query('UPDATE transactions SET amount=125 WHERE reason=$1', [`strategy:sell:${first[0].license.id}`]);
  assert.equal(await strategyLicenseFaults(app.pool), 0);
  if (native) {
    await app.pool.query('UPDATE characters SET cash=50000.5 WHERE id=$1', [outsider.id]);
    const cashBefore = [await cash(outsider), await cash(humanSeller)];
    await app.pool.query("CREATE FUNCTION strategy_reject_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason LIKE 'strategy:sell:%' THEN RAISE EXCEPTION 'injected strategy credit failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER strategy_reject_credit BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION strategy_reject_credit()');
    assert.notEqual((await buy(outsider, h, 'rollback')).code, 200);
    assert.deepEqual([await cash(outsider), await cash(humanSeller)], cashBefore);
    assert.equal((await app.pool.query('SELECT id FROM strategy_licenses WHERE buyer_account=$1', [outsider.account])).rows.length, 0);
    await app.pool.query('DROP TRIGGER strategy_reject_credit ON transactions'); await app.pool.query('DROP FUNCTION strategy_reject_credit()');
    assert.equal(await strategyLicenseFaults(app.pool), 0, 'Failed HTTP payout leaves no orphan debit or license');
  }
  process.env.DEPOT_PILOT = 'off';
  assert.notEqual((await call('POST', '/v1/strategies', agentSeller, body, 'disabled-publication')).code, 200);
  assert.notEqual((await buy(humanBuyer, h, 'disabled-purchase')).code, 200);
  const replayBefore = [await cash(agentBuyer), await cash(humanSeller)];
  // Lose only the HTTP cache, preserving the canonical paid domain receipt.
  // The real owned-license route must replay without a seller pair or new intake.
  await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2', [agentBuyer.account, 'agent-license']);
  assert(success(await buy(agentBuyer, h, 'agent-license')).replayed);
  assert.deepEqual([await cash(agentBuyer), await cash(humanSeller)], replayBefore);
  assert.equal(success(await call('GET', '/v1/strategies/library', agentBuyer)).strategies.length, 1);
  success(await call('GET', '/v1/strategies')).strategies.forEach(publicOnly);
  assert.equal(await strategyLicenseFaults(app.pool), 0);
  console.log(JSON.stringify({ status: 'PASS', database: native ? 'PostgreSQL' : 'memory', finding: 'STRAT-01 public hash removed',
    scope: 'Actual Fastify human/agent auth, private/public boundaries, strict finite publication, fractional paired payments, account replay, OFF recovery and real invariant tamper detection. Native additionally proves HTTP same-key allocation and trigger rollback; domain prospective real-clock proof is separate.' }));
} finally { await app.close(); }
